(function () {
	
	
	const TimeoutShim = {
		audioCtx: null,
		currentOscillatorId: 0,
		oscillatorActive: false,
		queue: [],
		activeIntervals: new Set(),
		MIN_OSCILLATOR_TIME: 200,
		
		addToQueue(item) {
			if (item.isInterval) {
				this.activeIntervals.add(item.id);
			}
			
			const index = this.queue.findIndex(existing => existing.executeTime > item.executeTime);
			if (index === -1) {
				this.queue.push(item);
			} else {
				this.queue.splice(index, 0, item);
			}

			if (!this.oscillatorActive || (this.queue[0] === item)) {
				this.restartOscillator();
			}
		},

		createTimedOscillator() {
			if (!this.queue.length) {
				this.oscillatorActive = false;
				return;
			}

			const oscillatorId = ++this.currentOscillatorId;
			
			try {
				if (!this.audioCtx) {
					this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
				}

				// Check if audio context is suspended
				if (this.audioCtx.state === 'suspended') {
					// Fall back to regular setTimeout for this execution
					const item = this.queue[0];
					const delay = Math.max(0, item.executeTime - performance.now());
					this.originalSetTimeout(() => {
						if (this.currentOscillatorId === oscillatorId) {
							this.processQueue(item.executeTime + this.MIN_OSCILLATOR_TIME);
						}
					}, delay);
					this.oscillatorActive = true;
					return;
				}

				const oscillator = this.audioCtx.createOscillator();
				const silence = this.audioCtx.createGain();
				silence.gain.value = 0;
				oscillator.connect(silence);
				silence.connect(this.audioCtx.destination);

				const timeStart = this.audioCtx.currentTime;
				const now = performance.now();
				const nextExecuteTime = this.queue[0].executeTime;
				const batchEndTime = nextExecuteTime + this.MIN_OSCILLATOR_TIME;
				const eventsInWindow = this.queue.filter(item => item.executeTime <= batchEndTime);
				const lastEventTime = eventsInWindow.length > 0 ? 
					eventsInWindow[eventsInWindow.length - 1].executeTime : 
					nextExecuteTime;
				
				const waitTime = Math.max(
					this.MIN_OSCILLATOR_TIME,
					lastEventTime - now
				) / 1000;

				oscillator.onended = () => {
					oscillator.disconnect();
					silence.disconnect();
					
					if (this.currentOscillatorId === oscillatorId) {
						this.processQueue(batchEndTime);
					}
				};

				this.oscillatorActive = true;
				oscillator.start(timeStart);
				oscillator.stop(timeStart + waitTime);
				
			} catch (e) {
				console.log('Error in audio timing, falling back:', e);
				// Fall back to regular setTimeout
				const item = this.queue[0];
				const delay = Math.max(0, item.executeTime - performance.now());
				this.originalSetTimeout(() => {
					if (this.currentOscillatorId === oscillatorId) {
						this.processQueue(item.executeTime + this.MIN_OSCILLATOR_TIME);
					}
				}, delay);
				this.oscillatorActive = true;
			}
		},

		processQueue(batchEndTime) {
			const now = performance.now();
			
			while (this.queue.length && this.queue[0].executeTime <= batchEndTime) {
				const item = this.queue.shift();
				
				if (item.isInterval && !this.activeIntervals.has(item.id)) {
					continue;
				}
				
				try {
					item.callback();
				} catch (e) {
					console.log('Error in timer callback:', e);
				}

				if (item.isInterval && this.activeIntervals.has(item.id)) {
					this.addToQueue({
						id: item.id,
						callback: item.callback,
						executeTime: now + item.delay,
						isInterval: true,
						delay: item.delay
					});
				}
			}

			if (this.queue.length) {
				this.restartOscillator();
			} else {
				this.oscillatorActive = false;
			}
		},

		restartOscillator() {
			this.currentOscillatorId++;
			this.createTimedOscillator();
		},

		setTimeout(callback, delay, ...args) {
			if (!callback || typeof callback !== 'function') return;
			const timeoutId = Math.random();
			
			this.addToQueue({
				id: timeoutId,
				callback: () => callback.apply(null, args),
				executeTime: performance.now() + delay,
				isInterval: false
			});
			
			return timeoutId;
		},

		setInterval(callback, delay, ...args) {
			if (!callback || typeof callback !== 'function') return;
			const intervalId = Math.random();
			
			this.addToQueue({
				id: intervalId,
				callback: () => callback.apply(null, args),
				executeTime: performance.now() + delay,
				isInterval: true,
				delay: delay
			});
			
			return intervalId;
		},

		clearInterval(id) {
			this.activeIntervals.delete(id);
			this.queue = this.queue.filter(item => item.id !== id);
			
			if (this.queue.length === 0) {
				this.currentOscillatorId++;
				this.oscillatorActive = false;
			}
			
			return true;
		},

		clearTimeout(id) {
			return this.clearInterval(id);
		},

		initialize() {
			this.originalSetTimeout = window.setTimeout;
			this.originalSetInterval = window.setInterval;
			this.originalClearTimeout = window.clearTimeout;
			this.originalClearInterval = window.clearInterval;

			window.setTimeout = this.setTimeout.bind(this);
			window.setInterval = this.setInterval.bind(this);
			window.clearTimeout = this.clearTimeout.bind(this);
			window.clearInterval = this.clearInterval.bind(this);
			
			return this;
		}
	};

	console.log("About to initialize TimeoutShim");
	const initializedTimeoutShim = TimeoutShim.initialize();
	
	function toDataURL(url, callback) {
	  var xhr = new XMLHttpRequest();
	  xhr.onload = function() {
		  
		var blob = xhr.response;
    
		if (blob.size > (55 * 1024)) {
		  callback(url); // Image size is larger than 25kb.
		  return;
		}

		var reader = new FileReader();
		
		
		reader.onloadend = function() {
		  callback(reader.result);
		}
		reader.readAsDataURL(xhr.response);
	  };
	  xhr.open('GET', url);
	  xhr.responseType = 'blob';
	  xhr.send();
	}
	
	function escapeHtml(unsafe){
		try {
			if (settings.textonlymode){ // we can escape things later, as needed instead I guess.
				return unsafe;
			}
			return unsafe
				 .replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;") || "";
		} catch(e){
			return "";
		}
	}

	function getAllContentNodes(element) { // takes an element.
		var resp = "";
		
		if (!element){return resp;}
		
		if (!element.childNodes || !element.childNodes.length){
			if (element.textContent){
				return escapeHtml(element.textContent) || "";
			} else {
				return "";
			}
		}
		
		element.childNodes.forEach(node=>{
			if (node.childNodes.length){
				resp += getAllContentNodes(node)
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)){
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1){
				if (!settings.textonlymode){
					if ((node.nodeName == "IMG") && node.src){
						node.src = node.src+"";
					}
					if (node.src.startsWith("data:")){
						resp += escapeHtml(node.alt || node.dataset.plainText || "");
					} else if (node.src.startsWith("http")){
						resp += node.outerHTML;
					}
				} else if (node.alt || node.dataset.plainText){
					resp += node.alt || node.dataset.plainText || "";
				}
			}
		});
		return resp;
	}
	
	var lastName = "";
	
	function processMessage(ele, skipProcessing=false){
	  
		//// console.log(ele);
		var labels = ele.querySelectorAll("[aria-label]");
		
		if (ele.querySelectorAll('[data-icon="tail-in"]')){
			lastName = "";
		}
		
		var chatmessage = "";
		var chatname = "";
		var chatimg = "";
		
		if (labels[0].getAttribute("role") && (labels[0].getAttribute("role")=="button")){
			if (labels[0].querySelector("img[src]")){
				chatimg = labels[0].querySelector("img[src]").src;
				chatname = escapeHtml(labels[1].textContent);
			} else {
				chatname = escapeHtml(labels[0].textContent);
			}
			if (chatname){
				lastName = chatname
			}
			// console.log("9");
		} else if (lastName){
			chatname = lastName;
			// console.log("8");
		}

		if (!chatname){
			try{
				chatname = escapeHtml(ele.children[1].children[1].children[0].children[0].textContent);
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
				// console.log("7");
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			try{
				
				chatname = escapeHtml(ele.children[1].children[1].children[0].children[1].children[0].dataset.prePlainText);
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
				// console.log("5");
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			try{
				chatname = escapeHtml(ele.children[1].children[0].children[1].children[0].dataset.prePlainText);
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
				// console.log("4");
			} catch(e){
				chatname = "";
			}
		}
		if (!chatname){
			try{
				chatname = ele.children[1].children[0].children[0].children[0].dataset.prePlainText
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
				// console.log("3");
			} catch(e){
				chatname = "";
			}
		}
		
		if (!chatname){
			if (ele.querySelector('span[aria-label]')){
				chatname = escapeHtml(ele.querySelector('span[aria-label]').ariaLabel);
				chatname = chatname.split(":")[0];
				if (chatname){
					lastName = chatname;
				} else if (lastName){
					chatname = lastName;
				}
			} else {
				return;
			}
			// console.log("1");
		}
		
		if (skipProcessing){
			return;
		}


		try{
			if (!chatname){
				chatname = escapeHtml(ele.children[1].children[1].children[0].children[0].textContent);
				if (chatname.split("] ").length>1){
					chatname = chatname.split("] ")[1];
				}
				chatname = chatname.split(":")[0];
				chatname = chatname.trim();
				// console.log("2");
			}

		} catch(e){
			chatname = "";
		}
		
		try {
			chatmessage = ele.querySelector(".selectable-text.copyable-text");
			chatmessage = getAllContentNodes(chatmessage);
		} catch(e){
			chatmessage = "";
		}
		
		if (!chatmessage){
			
			//	console.error(e);
				return;
			
		}
	
		
		if (!chatmessage){return;}

		
		var data = {};
		data.chatname = chatname;
		data.chatbadges = "";
		data.backgroundColor = "";
		data.textColor = "";
		data.chatmessage = chatmessage;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.textonly = settings.textonlymode || false;
		data.type = "whatsapp";
		
		
		// console.log(data);
		
		if (data.chatimg){
			toDataURL(data.chatimg, function(dataUrl) {
				data.chatimg = dataUrl;
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
				} catch(e){}
			});
		} else {
			data.chatimg = "";
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function(){});
			} catch(e){}
		}
	}

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try{
				if ("focusChat" == request){
					try{
						document.querySelector("footer").querySelector("div[contenteditable='true'][role='textbox']").focus();
					} catch(e){
						sendResponse(false);
						return
					}
					sendResponse(true);
					return;
				} 
				if (typeof request === "object"){
					if ("settings" in request){
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
				
			} catch(e){}
			sendResponse(false);
		}
	);
	
	var settings = {};
	// settings.textonlymode
	// settings.captureevents
	
	
	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function(response){  // {"state":isExtensionOn,"streamID":channel, "settings":settings}
		if ("settings" in response){
			settings = response.settings;
		}
	});

	function onElementInserted(target, callback) {
		var onMutationsObserved = function(mutations) {
			mutations.forEach(function(mutation) {
				if (mutation.addedNodes.length) {
					document.querySelector("#main").querySelectorAll("[data-id]:not([data-set123])").forEach((xx)=>{
						xx.dataset.set123 = true;
						// console.log(xx);
						setTimeout(function(ele){
							callback(ele);
						}, 300, xx); // give it time to load fully
					});
				}
			});
		};
		if (!target){return;}
		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

    console.log("Social stream inserted");
	
	
	setInterval(function(){
		var ele = document.querySelector("#main");
		if (ele && !ele.started){
			ele.started = true;
			
			setTimeout(function(ele){
				if (ele){
					document.querySelector("#main").querySelectorAll("[data-id]:not([data-set123])").forEach((xx)=>{
						xx.dataset.set123 = true;
						processMessage(xx, true);
					});
					onElementInserted(ele, function(element){
						processMessage(element);
					});
				}
			}, 2000, ele);
		}
		
	},1000);


	///////// the following is a loopback webrtc trick to get chrome to not throttle this twitch tab when not visible.
	try {
		var receiveChannelCallback = function(e){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				if (document.hidden){ // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e){}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate ||	remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e){localConnection.sendChannel.send("CONNECTED");};
		localConnection.sendChannel.onclose =  function(e){};
		localConnection.sendChannel.onmessage = function(e){};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() =>	{
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch(e){
		console.log(e);
	}
	
})();