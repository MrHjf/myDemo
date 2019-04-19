# webpack 笔记

## webpack 介绍
`webpack` 是一个javascript应用程序的静态模块打包器。当webpack处理应用程序时，它会递归地构建一个依赖关系图，包含了应用程序的每一个模块，并将这些模块打包成一个或多个bundle。

## 源码解读

```
// webpack/lib/webpack.js
// 对外暴露webpack这个方法，传options和callback
const webpack = (options, callback) => {
    // 主要是对options进行格式校验
	const webpackOptionsValidationErrors = validateSchema(
		webpackOptionsSchema,
		options
	);
	// 抛出格式错误
	if (webpackOptionsValidationErrors.length) {
		throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
	}
	let compiler;
	// options可以是一个数组[{entry: ''}, {entry: ''}], 也可以是一个配置对象{}
	if (Array.isArray(options)) {
	    //数组情况就是递归处理每个配置
		compiler = new MultiCompiler(options.map(options => webpack(options)));
	} else if (typeof options === "object") {
	    // 对象情况，就是在传入的options中加入webpack默认的配置
		options = new WebpackOptionsDefaulter().process(options);
        // 传入上下文，生成一个Compiler实例
        // 包括 hook，执行上下文的信息
		compiler = new Compiler(options.context);
		compiler.options = options;
		// compiler上绑定node环境变量
		new NodeEnvironmentPlugin().apply(compiler);

		// 判断是否有plugins，并执行。
		// 可见plugins的写法可以是一个function，或一个apply的方法，都接受compiler参数。
		if (options.plugins && Array.isArray(options.plugins)) {
			for (const plugin of options.plugins) {
				if (typeof plugin === "function") {
					plugin.call(compiler, compiler);
				} else {
					plugin.apply(compiler);
				}
			}
		}
		compiler.hooks.environment.call();
		compiler.hooks.afterEnvironment.call();
		// 开始执行webpack的配置
		compiler.options = new WebpackOptionsApply().process(options, compiler);
	} else {
		throw new Error("Invalid argument: options");
	}
	if (callback) {
		if (typeof callback !== "function") {
			throw new Error("Invalid argument: callback");
		}
		if (
			options.watch === true ||
			(Array.isArray(options) && options.some(o => o.watch))
		) {
			const watchOptions = Array.isArray(options)
				? options.map(o => o.watchOptions || {})
				: options.watchOptions || {};
			return compiler.watch(watchOptions, callback);
		}
		compiler.run(callback);
	}
	return compiler;
};

exports = module.exports = webpack;

// Compiler.js
// 由webpack.js可见webpack方法最后返回的是一个Compiler实例，而Compiler继承自Tapable这个库。
// 所以读懂webpack的插件和加载器机制，就得理解tapable和compiler。
class Compiler extends Tapable {
	constructor(context) {
		super();
		this.hooks = {};
	}
}

// WebpackOptionsApply.js
class WebpackOptionsApply extends OptionsApply {
	constructor() {
		super();
	}

	/**
	 * @param {WebpackOptions} options options object
	 * @param {Compiler} compiler compiler object
	 * @returns {WebpackOptions} options object
	 */
	process(options, compiler) {
		let ExternalsPlugin;
		// 处理一些配置
		compiler.outputPath = options.output.path;
		compiler.recordsInputPath = options.recordsInputPath || options.recordsPath;
		compiler.recordsOutputPath =
			options.recordsOutputPath || options.recordsPath;
		compiler.name = options.name;
		// TODO webpack 5 refactor this to MultiCompiler.setDependencies() with a WeakMap
		// @ts-ignore TODO
		compiler.dependencies = options.dependencies;
		// 处理webpack构建的目标，target可用值，web,webworker,node,async-node,node-webkit,electron-main
		if (typeof options.target === "string") {
			let JsonpTemplatePlugin;
			let FetchCompileWasmTemplatePlugin;
			let ReadFileCompileWasmTemplatePlugin;
			let NodeSourcePlugin;
			let NodeTargetPlugin;
			let NodeTemplatePlugin;

			switch (options.target) {
				case "web":
					JsonpTemplatePlugin = require("./web/JsonpTemplatePlugin");
					FetchCompileWasmTemplatePlugin = require("./web/FetchCompileWasmTemplatePlugin");
					NodeSourcePlugin = require("./node/NodeSourcePlugin");
					new JsonpTemplatePlugin().apply(compiler);
					new FetchCompileWasmTemplatePlugin({
						mangleImports: options.optimization.mangleWasmImports
					}).apply(compiler);
					new FunctionModulePlugin().apply(compiler);
					new NodeSourcePlugin(options.node).apply(compiler);
					new LoaderTargetPlugin(options.target).apply(compiler);
					break;
				case "webworker": {
					break;
				}
				case "node":
				case "async-node":
					break;
				case "node-webkit":
					break;
				case "electron-main":
					break;
				case "electron-renderer":
					break;
				default:
					throw new Error("Unsupported target '" + options.target + "'.");
			}
		}
		// @ts-ignore This is always true, which is good this way
		else if (options.target !== false) {
			options.target(compiler);
		} else {
			throw new Error("Unsupported target '" + options.target + "'.");
		}
        // 配置打包后的文件暴露方式，默认是输出文件，作为script标签引入
        // libraryTarget: 'amd', library暴露为amd模块 define()
        // libraryTarget：'commonjs', 以commonjs的模块方式暴露出来，module.export
        // umd支持所有模块方式
		if (options.output.library || options.output.libraryTarget !== "var") {
			const LibraryTemplatePlugin = require("./LibraryTemplatePlugin");
			new LibraryTemplatePlugin(
				options.output.library,
				options.output.libraryTarget,
				options.output.umdNamedDefine,
				options.output.auxiliaryComment || "",
				options.output.libraryExport
			).apply(compiler);
		}
		// externals 配置选项提供了「从输出的 bundle 中排除依赖」的方法。相反，所创建的 bundle 依赖于那些存在于用户环境(consumer's environment)中的依赖。
		// 此功能通常对 library 开发人员来说是最有用的，然而也会有各种各样的应用程序用到它
		if (options.externals) {
			ExternalsPlugin = require("./ExternalsPlugin");
			new ExternalsPlugin(
				options.output.libraryTarget,
				options.externals
			).apply(compiler);
		}

		// 这一段主要是根据参数，在对应hook上新增一些插件,执行插件。

		// 处理node环境变量
		if (options.optimization.nodeEnv) {
			const DefinePlugin = require("./DefinePlugin");
			new DefinePlugin({
				"process.env.NODE_ENV": JSON.stringify(options.optimization.nodeEnv)
			}).apply(compiler);
		}
		// 压缩优化
		if (options.optimization.minimize) {
			for (const minimizer of options.optimization.minimizer) {
				if (typeof minimizer === "function") {
					minimizer.call(compiler, compiler);
				} else {
					minimizer.apply(compiler);
				}
			}
		}

        // 性能优化
		if (options.performance) {
			const SizeLimitsPlugin = require("./performance/SizeLimitsPlugin");
			new SizeLimitsPlugin(options.performance).apply(compiler);
		}

		new TemplatedPathPlugin().apply(compiler);

		new RecordIdsPlugin({
			portableIds: options.optimization.portableRecords
		}).apply(compiler);

		new WarnCaseSensitiveModulesPlugin().apply(compiler);

		if (options.cache) {
			const CachePlugin = require("./CachePlugin");
			new CachePlugin(
				typeof options.cache === "object" ? options.cache : null
			).apply(compiler);
		}

		compiler.hooks.afterPlugins.call(compiler);
		if (!compiler.inputFileSystem) {
			throw new Error("No input filesystem provided");
		}
		compiler.resolverFactory.hooks.resolveOptions
			.for("normal")
			.tap("WebpackOptionsApply", resolveOptions => {
				return Object.assign(
					{
						fileSystem: compiler.inputFileSystem
					},
					options.resolve,
					resolveOptions
				);
			});
		compiler.resolverFactory.hooks.resolveOptions
			.for("context")
			.tap("WebpackOptionsApply", resolveOptions => {
				return Object.assign(
					{
						fileSystem: compiler.inputFileSystem,
						resolveToContext: true
					},
					options.resolve,
					resolveOptions
				);
			});
		compiler.resolverFactory.hooks.resolveOptions
			.for("loader")
			.tap("WebpackOptionsApply", resolveOptions => {
				return Object.assign(
					{
						fileSystem: compiler.inputFileSystem
					},
					options.resolveLoader,
					resolveOptions
				);
			});
		compiler.hooks.afterResolvers.call(compiler);
		return options;
	}
}

```
通过上面我们知道了`tapable`是webpack依赖的核心库, 读[tapable](https://github.com/webpack/tapable),
tapable是暴露了许多的Hook类，可用于给plugin创建钩子。
通常一个插件的写法是
```
class NewPlugins {
    constructor(options) {
        this.options = options || {}; // 接收外面传来的参数
    }

    // 实现一个apply方法，接收webpack返回的一个compiler
    apply(compiler) {
        // 因为整个的插件机制的核心就是tapable,所以如果要新增hook需要引入tapable库
        const Tapable = require('tapable');
        // 正常插件逻辑，通过compiler拿到webpack打包时的一些参数以及hooks。
        const pluginsHooks = compiler.hooks;
        // 通过pluginsHooks可以在webpack定义的一些hooks上绑定插件方法
        pluginsHooks.watchRun.tap('_test', () => {})

        // 可以新增一些hooks
        pluginsHooks.newHook = new Tapable.SyncHook(['args1', 'args2', 'args3']);
        // 新增的hook绑定插件
        pluginsHooks.newHook.tap('_newtest', (args1, args2, args3) => {})

        // 执行插件
        pluginsHooks.newHook.call(args1, args2, args3);

    }
}

module.exports = NewPlugins;

// 使用
plugins: [
    new NewPlugins({})
]

```
深入了解`tapable`是理解webpack插件化最重要的方式。
```
const {
        SyncHook,
       	SyncBailHook,
       	SyncWaterfallHook,
       	SyncLoopHook,
       	AsyncParallelHook,
       	AsyncParallelBailHook,
       	AsyncSeriesHook,
       	AsyncSeriesBailHook,
       	AsyncSeriesWaterfallHook
} = require('tapable');
```
`tapable`主要分为同步的hook的异步的hook，异步的hook又分为并行和串行。

## 同步的hook
同步的hook分为了基本的`SyncHook`，以及其他的hook，例如`bail,waterfall,loop`。
同步的hook只能通过`tap`方法添加插件，`waterfall`会同步的执行多个插件，并把上个插件的值向下传递。

## 异步的hook
异步的hook有并行和串行，并行就是多个异步hook同步执行，串行则是有顺序的执行。
可以通过`tap(), myHook.tapAsync() and myHook.tapPromise()`来新增插件。

hook的执行通过`call(args)`来执行并传递参数给执行方法。

