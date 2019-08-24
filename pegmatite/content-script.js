/* global chrome */


let waitTime = 3000; //! PlantUMLの描画を開始するまでの待ち時間のデフォルト値（Optionで変更可能）

// console.info(`config = ${config}`);
chrome.storage.local.get({
	// baseUrl: "https://www.plantuml.com/plantuml/img/",
	waitTime: 3000
}, function(items) {
	waitTime = items.waitTime;
});

// //! タイトルの監視 （ https://qiita.com/munieru_jp/items/a6f1433652124a2165e4 のコピペ）
// //監視ターゲットの取得
// // const target = document.querySelector('div.line.section-0.line-title.section-title');
// const target = document.querySelector('.page');

// //オブザーバーの作成
// const observer = new MutationObserver(records => {
// 	//なんらかの処理を行なう
// 	// console.info('タイトルが更新されました');
// 	console.info('コンテンツが更新されました');
// 	debugger;
// });

// //監視オプションの作成
// const options = {
// 	attributes: true,
// 	characterData: true,
// 	childList: true
// };

// //監視の開始
// observer.observe(target, options);

// //監視の停止（実際には特定条件下で実行）
// // let shouldStopObserving = false;
// // if(shouldStopObserving){
// //     observer.disconnect();
// // }

// //! タイトルの変更監視 ここまで

const umlImgId = 'tempUmlImg';

setInterval(function(){
	const ScrapboxPreUrl = 'ScrapboxPreUrl';
	let currentUrl = window.location.href;
	// if(preUrl != ''){
	try{		
		if(currentUrl != localStorage.getItem(ScrapboxPreUrl)){
			console.log('urlが変わりました❗');
			// 画面上に前ページの要素が表示されていたら、削除する
			if(document.querySelector('div.lines > div').id == umlImgId){
				document.querySelector('div.lines > div').remove();
			}
			// run(config); // 念の為の処理（なぜか描画されない場合があるため）
			PlantUMLの描画();
		}
	}catch{

	}
	//preUrl = currentUrl;
	localStorage.setItem(ScrapboxPreUrl,currentUrl);
	// }
	// console.log(`currentUrl = ${currentUrl}`);
// },2000);
},1000);


function encode64(data) {
	for (var r = "", i = 0, n = data.length; i < n; i += 3) {
		r += append3bytes(
			data.charCodeAt(i),
			i + 1 !== n ? data.charCodeAt(i + 1) : 0,
			i + 2 !== n ? data.charCodeAt(i + 2) : 0);
	}
	return r;
}

function append3bytes(b1, b2, b3) {
	var c1 = b1 >> 2;
	var c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
	var c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
	var c4 = b3 & 0x3F;
	return encode6bit(c1 & 0x3F) +
		encode6bit(c2 & 0x3F) +
		encode6bit(c3 & 0x3F) +
		encode6bit(c4 & 0x3F);
}

function encode6bit(b) {
	if (b < 10) return String.fromCharCode(48 + b);
	b -= 10;
	if (b < 26) return String.fromCharCode(65 + b);
	b -= 26;
	if (b < 26) return String.fromCharCode(97 + b);
	b -= 26;
	if (b === 0) return "-";
	if (b === 1) return "_";
	return "?";
}

function compress(s) {
	s = unescape(encodeURIComponent(s));
	return encode64(deflate(s));
}

function escapeHtml(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function replaceElement(umlElem, srcUrl) {
	var parent = umlElem.parentNode;
	var imgElem = document.createElement("img");
	imgElem.setAttribute("src", escapeHtml(srcUrl));
	imgElem.setAttribute("title", "");
	parent.replaceChild(imgElem, umlElem);

	imgElem.ondblclick = function() {
		parent.replaceChild(umlElem, imgElem);
	};
	umlElem.ondblclick = function() {
		parent.replaceChild(imgElem, umlElem);
	};
}

//Todo:表示した画面から遷移した際に、その画像が残り続けてしまっている
// 佐藤追加
function appendElement(elementID, srcUrl) {
	let elm = document.querySelector('#'+umlImgId);
	try{
		elm.parentNode.removeChild(elm);
	}catch{}
	// var parent = umlElem.parentNode;
	var imgElem = document.createElement("img");
	imgElem.setAttribute("src", escapeHtml(srcUrl));
	imgElem.setAttribute("title", "");

	let divElem = document.createElement('div');
	divElem.setAttribute("id", umlImgId);
	divElem.appendChild(imgElem);

	let labelElem = document.createElement('label');
	labelElem.textContent = srcUrl;

	var parent = imgElem.parentNode;

	try{
		// なぜか反応しない
		imgElem.ondblclick = function() {
			console.log('123');
			parent.replaceChild(labelElem, imgElem);
		};
		labelElem.ondblclick = function() {
			console.log('456');
			parent.replaceChild(imgElem, labelElem);
		};
	}catch{}

	// コードブロック末尾行の次の要素に兄弟要素としてInsertする
	document.querySelector('#'+elementID).insertAdjacentHTML('afterend',divElem.outerHTML);
}

let lastUmlLineId = "";
let lastFetchImageTime = new Date();
let hasRefreshImage = false;

// なぜか、関数を１つにまとめると、変数に値がSetされなくなってしまった
// function scrapbox用のソースコード処理(elem){
// 	let lineElms = elem.querySelectorAll(".line");
// 	let returnStr = '';
// 	let isInPlantUmlCode = false;
// 	let isFirstRowOfCodeBlock = false;
// 	let isPlantUmlソースコード = false;
// 	//! code-block が、コードブロックの開始。拡張子が「puml」なら、それ以降の文字列がソースコード。（classに「indent-0」が含まれるか、コンテンツ末尾までがコード）
// 	for(let i=1; i < lineElms.length; i++){ // 先頭行（タイトル）は無視
// 		let classStr = lineElms[i].getAttribute('class');
// 		let childElmClassStr = lineElms[i].querySelector('span').getAttribute('class'); //子要素のspan要素のclass属性
// 		if(childElmClassStr.indexOf('code-block')>=0){
// 			if((isFirstRowOfCodeBlock === false)&&(isInPlantUmlCode === false)){
// 				isFirstRowOfCodeBlock = true;
// 				isInPlantUmlCode = true;
// 			}
// 			// lineElms[i].textContent.indexOf('code:')>=0 ← code:はtextContentには含まれない
// 			if(isFirstRowOfCodeBlock &&(lineElms[i].textContent.indexOf('.puml')>=0||lineElms[i].textContent.indexOf('.uml')>=0)){
// 				// isFirstRowOfCodeBlock = false; // 初期化
// 				isPlantUmlソースコード = true;
// 			}
// 		}
// 		if(isInPlantUmlCode && isPlantUmlソースコード){
// 			if(childElmClassStr.indexOf('code-block')===-1){
// 				isInPlantUmlCode = false;
// 				break;
// 			}else{
// 				if(isFirstRowOfCodeBlock === false){
// 					returnStr = returnStr + lineElms[i].textContent.trim()+ "\n";
// 					// lastUmlLineId = lineElms[i].getAttribute('id');
// 					this.lastUmlLineId = lineElms[i].getAttribute('id');
// 					// console.log(`${i}、${this.lastUmlLineId}`);
// 				}
// 			}
// 		}
// 		if(isFirstRowOfCodeBlock) isFirstRowOfCodeBlock = false;
// 	};
// 	return returnStr;
// }


var siteProfiles = {
	"default": {
		"selector": "pre[lang='uml'], pre[lang='puml'], pre[lang='plantuml']",
		"extract": function (elem) {
			return elem.querySelector("code").textContent.trim();
		},
		"replace": function (elem) {
			return elem;
		},
		"compress": function (elem) {
			return compress(elem.querySelector("code").textContent.trim());
		}
	},
	"gitpitch.com": {
		"selector": "pre code.lang-uml",
		"extract": function (elem) {
			return elem.innerText.trim();
		},
		"replace": function (elem) {
			return elem;
		},
		"compress": function (elem) {
			return compress(elem.innerText.trim());
		}
	},
	"gitlab.com": {
		"selector": "pre code span.line, div div pre", // markdown, asciidoc
		"extract": function (elem) {
			return elem.textContent.trim();
		},
		"replace": function (elem) {
			var child = elem.querySelector("code");
			if ( child !=null) return child; // markdown
			return elem; // asciidoc
		},
		"compress": function (elem) {
			var plantuml = "";
			if (elem.tagName == "SPAN"){ // markdown
				elem.parentNode.querySelectorAll("span.line").forEach(function(span){
					plantuml = plantuml + span.textContent.trim() + "\n";
				});				
			} else { // asciidoc
				plantuml = elem.textContent.trim();
			}			
			return compress(plantuml);
		}
	},
	"bitbucket.org": {
		"selector": "div.codehilite.language-plantuml > pre",
		"extract": function (elem) {
			return elem.innerText.trim();
		}
	},
	"backlog.jp": {
		"selector": "pre.lang-uml, pre.lang-puml, pre.lang-plantuml",
		"extract": function (elem) {
			return elem.innerText.trim();
		}
	},
	// 佐藤追加部分
	"scrapbox.io":{
		"selector": ".lines",
		"extract": function (elem) {
			// .lineの全テキストを取得
			let lineElms = elem.querySelectorAll(".line");
			let returnStr = '';
			let isInPlantUmlCode = false;
			let isFirstRowOfCodeBlock = false;
			let isPlantUmlソースコード = false;
			//! code-block が、コードブロックの開始。拡張子が「puml」なら、それ以降の文字列がソースコード。（classに「indent-0」が含まれるか、コンテンツ末尾までがコード）
			for(let i=1; i < lineElms.length; i++){ // 先頭行（タイトル）は無視
				// console.log(lineElms[i]);
				let classStr = lineElms[i].getAttribute('class');
				let childElmClassStr = lineElms[i].querySelector('span').getAttribute('class'); //子要素のspan要素のclass属性
				if(childElmClassStr.indexOf('code-block')>=0){
					if((isFirstRowOfCodeBlock === false)&&(isInPlantUmlCode === false)){
						isFirstRowOfCodeBlock = true;
						isInPlantUmlCode = true;
					}
					// lineElms[i].textContent.indexOf('code:')>=0 ← code:はtextContentには含まれない
					if(isFirstRowOfCodeBlock &&(lineElms[i].textContent.indexOf('.puml')>=0||lineElms[i].textContent.indexOf('.uml')>=0||lineElms[i].textContent.indexOf('.plantuml')>=0)){
						// isFirstRowOfCodeBlock = false; // 初期化
						isPlantUmlソースコード = true;
					}
				}
				if(isInPlantUmlCode && isPlantUmlソースコード){
					if(childElmClassStr.indexOf('code-block')===-1){
						isInPlantUmlCode = false;
						break;
					}else{
						if(isFirstRowOfCodeBlock === false){
							returnStr = returnStr + lineElms[i].textContent.trim()+ "\n";
							// lastUmlLineId = lineElms[i].getAttribute('id');
							this.lastUmlLineId = lineElms[i].getAttribute('id');
							// console.log(`${i}、${this.lastUmlLineId}`);
						}
					}
				}
				if(isFirstRowOfCodeBlock) isFirstRowOfCodeBlock = false;
			};
			// 最初にcode:**.pumlを記述した後、内容を書いた後に @startuml か @enduml を書くと、表示されない
			if((returnStr !== '')&&(returnStr.indexOf('@startuml')===-1||returnStr.indexOf('@enduml')===-1)){
				console.error('拡張子がPlantUML（puml/uml）にも関わらず@startuml か @enduml が含まれていません' );
			}
			return returnStr;
		},
		"getLastUmlLineId":function(){
			return this.lastUmlLineId;
		}
	}
};


function loop(counter, retry, siteProfile, baseUrl){
	counter++;
	if (document.querySelector("i[aria-label='Loading content…']")==null) counter+=retry;
	var id = setTimeout(loop,100,counter,retry, siteProfile, baseUrl);
	if(counter>=retry){
		clearTimeout(id);
		onLoadAction(siteProfile, baseUrl);
	}
}
// Scrapbox用に上のloop関数を修正（使用していないかもしれない）
function loopForScrapbox(counter, retry, siteProfile, baseUrl){
	counter++;
	if (document.querySelectorAll(".line").length===0) counter+=retry;
	var id = setTimeout(loop,100,counter,retry, siteProfile, baseUrl);
	if(counter>=retry){
		clearTimeout(id);
		onLoadAction(siteProfile, baseUrl);
	}
}

function onLoadAction(siteProfile, baseUrl){
	[].forEach.call(document.querySelectorAll(siteProfile.selector), function (umlElem) {
		var plantuml = siteProfile.extract(umlElem);
		if (plantuml.substr(0, "@start".length) !== "@start") {
			return;
		}
		var plantUmlServerUrl = baseUrl + siteProfile.compress(umlElem);
		var replaceElem = siteProfile.replace(umlElem);
		if (plantUmlServerUrl.lastIndexOf("https", 0) === 0) { // if URL starts with "https"
			replaceElement(replaceElem, plantUmlServerUrl);
		} else {
			// to avoid mixed-content
			chrome.runtime.sendMessage({ "action": "plantuml", "url": plantUmlServerUrl }, function(dataUri) {
				replaceElement(replaceElem, dataUri);
			});
		}
	});
}

function run(config) {
	var hostname = window.location.hostname.split(".").slice(-2).join(".");
	var siteProfile = siteProfiles[hostname] || siteProfiles["default"];

	let _baseUrl = '';
	if(config == undefined){
		_baseUrl = undefined;
	}else{
		_baseUrl = config.baseUrl;
	}
	// var baseUrl = config.baseUrl || "https://www.plantuml.com/plantuml/img/"; //svgもサポートしている
	var baseUrl = _baseUrl || "https://www.plantuml.com/plantuml/svg/"; //imgもサポートしている

	if(hostname ==! "scrapbox.io"){
		if (document.querySelector("i[aria-label='Loading content…']")!=null){ // for wait loading @ gitlab.com
			loop(1, 10, siteProfile, baseUrl);
		}
	}else{
		// Todo:Scrapboxの場合、コンテンツの読み込みを待つ処理を追加（うまくいかなかった）
		// if (document.querySelectorAll(".line").length===0){ // for wait loading @ scrapbox.io
		// 	loopForScrapbox(1, 10, siteProfile, baseUrl);
		// }
	}
	
	[].forEach.call(document.querySelectorAll(siteProfile.selector), function (umlElem) {
		
		var plantuml = siteProfile.extract(umlElem);
		if (plantuml.substr(0, "@start".length) !== "@start") return;
		var plantUmlServerUrl =  '';
		
		if(hostname === "scrapbox.io"){
			plantUmlServerUrl = baseUrl + compress(siteProfile.extract(umlElem)); // PlantUMLのソースを抽出した後にエンコードする
			appendElement(siteProfile.getLastUmlLineId(),plantUmlServerUrl); // 何故か getLastUmlLineId()がundefinedになる場合がある

			document.querySelector('#text-input').addEventListener('keydown', () => {
				hasRefreshImage = false;		
				refreshPlantUmlImage();
				setInterval(function(){
					if(hasRefreshImage === false) refreshPlantUmlImage();
				},3000);
			}, { once:true } ); //１度のみイベントハンドラを追加
		}
		else{
			plantUmlServerUrl =  baseUrl + siteProfile.compress(umlElem);
			var replaceElem = siteProfile.replace(umlElem);
			if (plantUmlServerUrl.lastIndexOf("https", 0) === 0) { // if URL starts with "https"
				replaceElement(replaceElem, plantUmlServerUrl);
			} else {
				// to avoid mixed-content
				chrome.runtime.sendMessage({ "action": "plantuml", "url": plantUmlServerUrl }, function(dataUri) {
					replaceElement(replaceElem, dataUri);
				});
			}
		}
	});
}

function refreshPlantUmlImage(){
	// 直前に実行されたのが3秒以上前なら
	var d1 = new Date();         //例： new Date('2017/01/05 12:15:20');
	var d2 = lastFetchImageTime; //例： new Date('2016/12/15 01:09:02');
	try{
		var diffTime = d1.getTime() - d2.getTime(); //! ここで落ちることがあった！
		var diffSeconds = Math.floor(diffTime / 1000);
		if(diffSeconds>3){
			lastFetchImageTime = d1;
			hasRefreshImage = true;
			chrome.storage.local.get("baseUrl", function(config){
				console.info(`${new Date()}: PlantUMLの画像を再描画します`);
				// run(config);
				run();
				// hasRefreshImage = true;
			});	
		}
	}catch{
		run(); // 念の為追加 2019-08-24
	}
}


chrome.storage.local.get("baseUrl", function(config) {
	if (window.location.hostname === "bitbucket.org") {
		var observer = new MutationObserver(function() {
			if (document.getElementsByClassName("language-plantuml").length > 0) {
				run(config);
				observer.disconnect();
			}
		});

		observer.observe(document.body, {
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true
		});
	}

	setTimeout(function(){ // Scrapboxのページコンテンツが読み込まれるのを待つ（これを入れないとScrapboxでPlantUMLが表示されないので注意❗
		run(config);
	// },2000); // コンテンツが多いと、２秒では足りないかもしれない
	// },3000); // これでも表示されないことがあった
	// },4000);
	}, waitTime);
});

function PlantUMLの描画(config){
	setTimeout(function(){ // Scrapboxのページコンテンツが読み込まれるのを待つ（これを入れないとScrapboxでPlantUMLが表示されないので注意❗
		//debugger;
		//run(config);
		run();
	// },2000); // コンテンツが多いと、２秒では足りないかもしれない
	// },3000); // これでも表示されないことがあった
	//},4000);
	}, waitTime);
}
