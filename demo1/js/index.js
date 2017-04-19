window.onload=function(){
	isSupport();
	clickEvent();
	browersScreen();
}
function clickEvent(){
	var btns = document.getElementsByClassName("main-content-btn")[0].getElementsByTagName("a");
	var one = document.getElementById("main-content-one");
	var two = document.getElementById("main-content-two");
	for(var i = 0,len=btns.length;i<len;i++){
		(function(i){
			btns[i].onclick=function(){
				if(i == 0){
					modalAlert();
				}else{
					this.className = "clickbtn";
					one.style.display="none";
					two.style.display="block";
					btns[i-1].className = "unclickbtn";
				}
			}
		})(i);
	}
	document.getElementById("close").onclick = function(){
		var mask = document.getElementById("mask");
		mask.style.display="none";
		btns[1].className = "unclickbtn";
		one.style.display="block";
		two.style.display="none";
		btns[0].className = "clickbtn";
	}
}
function modalAlert(){
	var height = document.body.scrollHeight;
	var mask = document.getElementById("mask");
	mask.style.height = height+"px";
	mask.style.display = "block";
}
function isSupport(){
	if(!document.getElementsByClassName){
		document.getElementsByClassName = function(className, element){
			var children = (element || document).getElementsByTagName('*');
			var elements = new Array();
			for (var i=0; i<children.length; i++){
				var child = children[i];
				var classNames = child.className.split(' ');
				for (var j=0; j<classNames.length; j++){
					if (classNames[j] == className){ 
						elements.push(child);
						break;
					}
				}
			} 
			return elements;
		};
	}
}
function browersScreen(){
	var container = document.getElementsByClassName("container")[0];
	if(window.screen.width <= 1366){
		container.style.height = "1300px";
	}else if(window.screen.width >=1920){
		container.style.height = "1500px";
	}
}