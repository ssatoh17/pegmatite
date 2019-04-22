/* global chrome */

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
	"scrapbox.io":{
		"selector": ".lines",
		"extract": function (elem) {
			// .lineの全テキストを取得
			let lineElms = elem.querySelectorAll(".line");
			let retunStr = '';
			//! code-block が、コードブロックの開始。拡張子が「puml」なら、それ以降の文字列がソースコード。（classに「indent-0」が含まれるか、末尾まで）
			for(let i=2; i < lineElms.length; i++){ // 先頭行（タイトル）とファイル名は無視
				retunStr = retunStr + lineElms[i].textContent.trim() + "\n";
			};
			return retunStr;
		},
		"replace": function (elem) {
			let lineElms = elem.querySelectorAll(".line");
			let retunStr = '';
			for(let i=2; i < lineElms.length; i++){ // 先頭行（タイトル）とファイル名は無視
				retunStr = retunStr + lineElms[i].textContent.trim();
			};
			return retunStr;
		},
		"compress": function (elem) {
			let lineElms = elem.querySelectorAll(".line");
			let retunStr = '';
			let isInPlantUmlCode = true;
			let isFirstRowOfCodeBlock = true;
			let isPlantUmlソースコード = false;
			//! code-block が、コードブロックの開始。拡張子が「puml」なら、それ以降の文字列がソースコード。（classに「indent-0」が含まれるか、コンテンツ末尾までがコード）
			for(let i=1; i < lineElms.length; i++){ // 先頭行（タイトル）は無視
				let classStr = lineElms[i].getAttribute('class');
				let childElmClassStr = lineElms[i].querySelector('span').getAttribute('class'); //子要素のspan要素のclass属性
				if(childElmClassStr.indexOf('code-block')>=0){
					if(isFirstRowOfCodeBlock === false){
						isFirstRowOfCodeBlock = true;
						isInPlantUmlCode = true;
					}
					// lineElms[i].textContent.indexOf('code:')>=0 ← code:はtextContentには含まれない
					if(isFirstRowOfCodeBlock &&lineElms[i].textContent.indexOf('.puml')>=0){
						isFirstRowOfCodeBlock = false; // 初期化
						isPlantUmlソースコード = true;
					}
				}
				if(isInPlantUmlCode && isPlantUmlソースコード){
					if(childElmClassStr.indexOf('code-block')===-1){
						isInPlantUmlCode = false;
						break;
					}else{
						retunStr = retunStr + lineElms[i].textContent.trim()+ "\n";
					}
				}
			};
			return compress(retunStr);
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

function onLoadAction(siteProfile, baseUrl){
	[].forEach.call(document.querySelectorAll(siteProfile.selector), function (umlElem) {
		var plantuml = siteProfile.extract(umlElem);
		if (plantuml.substr(0, "@start".length) !== "@start") return;
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
	var baseUrl = config.baseUrl || "https://www.plantuml.com/plantuml/img/"; //svgもサポートしている
	if (document.querySelector("i[aria-label='Loading content…']")!=null){ // for wait loading @ gitlab.com
		loop(1, 10, siteProfile, baseUrl);
	}
	//Todo:Scrapboxの場合、コンテンツの読み込みを待つ処理をここに入れたい
	[].forEach.call(document.querySelectorAll(siteProfile.selector), function (umlElem) {
		var plantuml = siteProfile.extract(umlElem);
		if (plantuml.substr(0, "@start".length) !== "@start") return;
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

	setTimeout(function(){ // Scrapboxのページコンテンツが読み込まれるのを待つ
		run(config);
	},2000);
});
