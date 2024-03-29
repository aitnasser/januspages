// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
 		var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
// 		var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the gateway. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your gateway (or pool of gateways),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//		var server = [
//			"ws://" + window.location.hostname + ":8188",
//			"/janus"
//		];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//


var janus = null;
var screentest = null;
var started = false;

var myusername = null;
var myid = null;

var role = null;
var room = null;
var source = null;

var spinner = null;


// Just an helper to generate random usernames
function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
    	var randomPoz = Math.floor(Math.random() * charSet.length);
    	randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}


$(document).ready(function() {
   	// Initialize the library (console debug enabled)
	Janus.init({debug: true, callback: function() {
		// Use a button to start the demo
		$('#start').click(function() {
			if(started)
				return;
			started = true;
			$(this).attr('disabled', true).unbind('click');
			// Make sure the browser supports WebRTC
			if(!Janus.isWebrtcSupported()) {
				bootbox.alert("No WebRTC support... ");
				return;
			}
			// Create session
			janus = new Janus(
				{
					server: server,
					success: function() {
						// Attach to video MCU test plugin
						janus.attach(
							{
								plugin: "janus.plugin.videoroom",
								success: function(pluginHandle) {
									$('#details').remove();
									screentest = pluginHandle;
									console.log("Plugin attached! (" + screentest.getPlugin() + ", id=" + screentest.getId() + ")");
									// Prepare the username registration
									$('#screenmenu').removeClass('hide').show();
									$('#createnow').removeClass('hide').show();
									$('#create').click(shareScreen);
									$('#joinnow').removeClass('hide').show();
									$('#join').click(joinScreen);
									$('#desc').focus();
									$('#start').removeAttr('disabled').html("Stop")
										.click(function() {
											$(this).attr('disabled', true);
											janus.destroy();
										});
								},
								error: function(error) {
									console.log("  -- Error attaching plugin... " + error);
									bootbox.alert("Error attaching plugin... " + error);
								},
								consentDialog: function(on) {
									console.log("Consent dialog should be " + (on ? "on" : "off") + " now");
									if(on) {
										// Darken screen
										$.blockUI({
											message: '',
											css: {
												border: 'none',
												padding: '15px',
												backgroundColor: 'transparent',
												color: '#aaa'
											} });
									} else {
										// Restore screen
										$.unblockUI();
									}
								},
								onmessage: function(msg, jsep) {
									console.log(" ::: Got a message (publisher) :::");
									console.log(JSON.stringify(msg));
									var event = msg["videoroom"];
									console.log("Event: " + event);
									if(event != undefined && event != null) {
										if(event === "created") {
											// Our own screen sharing session has been created, join it
											room = msg["room"];
											console.log("Screen sharing session created: " + room);
											myusername = randomString(12);
											var register = { "request": "join", "room": room, "ptype": "publisher", "display": myusername };
											screentest.send({"message": register});
										} else if(event === "joined") {
											myid = msg["id"];
											$('#session').html(room);
											$('#title').html(msg["description"]);
											console.log("Successfully joined room " + msg["room"] + " with ID " + myid);
											if(role === "publisher") {
												// This is our session, publish our stream
												console.log("Negotiating WebRTC stream for our screen");
												screentest.createOffer(
													{
														media: { video: "screen", audio: false, videoRecv: false},	// Screen sharing doesn't work with audio, and Publishers are sendonly
														success: function(jsep) {
															console.log("Got publisher SDP!");
															console.log(jsep);
															var publish = { "request": "configure", "audio": true, "video": true };
															screentest.send({"message": publish, "jsep": jsep});
														},
														error: function(error) {
															console.log("WebRTC error:");
															console.log(error);
															bootbox.alert("WebRTC error... " + JSON.stringify(error));
														}
													});
											} else {
												// We're just watching a session, any feed to attach to?
												if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
													var list = msg["publishers"];
													console.log("Got a list of available publishers/feeds:");
													console.log(list);
													for(var f in list) {
														var id = list[f]["id"];
														var display = list[f]["display"];
														console.log("  >> [" + id + "] " + display);
														newRemoteFeed(id, display)
													}
												}
											}
										} else if(event === "event") {
											// Any feed to attach to?
											if(role === "listener" && msg["publishers"] !== undefined && msg["publishers"] !== null) {
												var list = msg["publishers"];
												console.log("Got a list of available publishers/feeds:");
												console.log(list);
												for(var f in list) {
													var id = list[f]["id"];
													var display = list[f]["display"];
													console.log("  >> [" + id + "] " + display);
													newRemoteFeed(id, display)
												}
											} else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
												// One of the publishers has gone away?
												var leaving = msg["leaving"];
												console.log("Publisher left: " + leaving);
												if(role === "listener" && msg["leaving"] === source) {
													bootbox.alert("The screen sharing session is over, the publisher left", function() {
														window.location.reload();
													});
												}
											} else if(msg["error"] !== undefined && msg["error"] !== null) {
												bootbox.alert(msg["error"]);
											}
										}
									}
									if(jsep !== undefined && jsep !== null) {
										console.log("Handling SDP as well...");
										console.log(jsep);
										screentest.handleRemoteJsep({jsep: jsep});
									}
								},
								onlocalstream: function(stream) {
									console.log(" ::: Got a local stream :::");
									console.log(JSON.stringify(stream));
									$('#screenmenu').hide();
									$('#room').removeClass('hide').show();
									if($('#screenvideo').length === 0) {
										$('#screencapture').append('<video class="rounded centered" id="screenvideo" width="100%" height="100%" autoplay muted="muted"/>');
									}
									attachMediaStream($('#screenvideo').get(0), stream);
									bootbox.alert("Your screen sharing session just started: pass the <b>" + room + "</b> session identifier to those who want to attend.");
								},
								onremotestream: function(stream) {
									// The publisher stream is sendonly, we don't expect anything here
								},
								oncleanup: function() {
									console.log(" ::: Got a cleanup notification :::");
									$('#screencapture').empty();
									$('#room').hide();
								}
							});
					},
					error: function(error) {
						console.log(error);
						bootbox.alert(error, function() {
							window.location.reload();
						});
					},
					destroyed: function() {
						window.location.reload();
					}
				});
		});
	}});
});

function checkEnterShare(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		shareScreen();
		return false;
	} else {
		return true;
	}
}

function switchToHttps() {
	window.location.href = "https:" + window.location.href.substring(window.location.protocol.length);
	return false;
}

function shareScreen() {
	// Make sure HTTPS is being used
	if(window.location.protocol !== 'https:') {
		bootbox.alert('Sharing your screen only works on HTTPS: click <b><a href="#" onclick="return switchToHttps();">here</a></b> to try the https:// version of this page');
		$('#start').attr('disabled', true);
		return;
	}
	// Create a new room
	$('#desc').attr('disabled', true);
	$('#create').attr('disabled', true).unbind('click');
	$('#roomid').attr('disabled', true);
	$('#join').attr('disabled', true).unbind('click');
	var desc = $('#desc').val();
	if(desc === "") {
		bootbox.alert("Please insert a description for the room");
		$('#desc').removeAttr('disabled', true);
		$('#create').removeAttr('disabled', true).click(shareScreen);
		$('#roomid').removeAttr('disabled', true);
		$('#join').removeAttr('disabled', true).click(joinScreen);
		return;
	}
	role = "publisher";
	var create = { "request": "create", "description": desc, "bitrate": 0, "publishers": 1 };
	screentest.send({"message": create});
}

function checkEnterJoin(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		joinScreen();
		return false;
	} else {
		return true;
	}
}

function joinScreen() {
	// Join an existing screen sharing session
	$('#desc').attr('disabled', true);
	$('#create').attr('disabled', true).unbind('click');
	$('#roomid').attr('disabled', true);
	$('#join').attr('disabled', true).unbind('click');
	var roomid = $('#roomid').val();
	if(isNaN(roomid)) {
		bootbox.alert("Session identifiers are numeric only");
		$('#desc').removeAttr('disabled', true);
		$('#create').removeAttr('disabled', true).click(shareScreen);
		$('#roomid').removeAttr('disabled', true);
		$('#join').removeAttr('disabled', true).click(joinScreen);
		return;
	}
	room = parseInt(roomid);
	role = "listener";
	myusername = randomString(12);
	var register = { "request": "join", "room": room, "ptype": "publisher", "display": myusername };
	screentest.send({"message": register});
}

function newRemoteFeed(id, display) {
	// A new feed has been published, create a new plugin handle and attach to it as a listener
	source = id;
	var remoteFeed = null;
	janus.attach(
		{
			plugin: "janus.plugin.videoroom",
			success: function(pluginHandle) {
				remoteFeed = pluginHandle;
				console.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
				console.log("  -- This is a subscriber");
				// We wait for the plugin to send us an offer
				var listen = { "request": "join", "room": room, "ptype": "listener", "feed": id };
				remoteFeed.send({"message": listen});
			},
			error: function(error) {
				console.log("  -- Error attaching plugin... " + error);
				bootbox.alert("Error attaching plugin... " + error);
			},
			onmessage: function(msg, jsep) {
				console.log(" ::: Got a message (listener) :::");
				console.log(JSON.stringify(msg));
				var event = msg["videoroom"];
				console.log("Event: " + event);
				if(event != undefined && event != null) {
					if(event === "attached") {
						// Subscriber created and attached
						if(spinner === undefined || spinner === null) {
							var target = document.getElementById('#screencapture');
							spinner = new Spinner({top:100}).spin(target);
						} else {
							spinner.spin();
						}
						console.log("Successfully attached to feed " + id + " (" + display + ") in room " + msg["room"]);
						$('#screenmenu').hide();
						$('#room').removeClass('hide').show();
					} else {
						// What has just happened?
					}
				}
				if(jsep !== undefined && jsep !== null) {
					console.log("Handling SDP as well...");
					console.log(jsep);
					// Answer and attach
					remoteFeed.createAnswer(
						{
							jsep: jsep,
							media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
							success: function(jsep) {
								console.log("Got SDP!");
								console.log(jsep);
								var body = { "request": "start", "room": room };
								remoteFeed.send({"message": body, "jsep": jsep});
							},
							error: function(error) {
								console.log("WebRTC error:");
								console.log(error);
								bootbox.alert("WebRTC error... " + error);
							}
						});
				}
			},
			onlocalstream: function(stream) {
				// The subscriber stream is recvonly, we don't expect anything here
			},
			onremotestream: function(stream) {
				if(spinner !== undefined && spinner !== null)
					spinner.stop();
				if($('#screenvideo').length === 0) {
					$('#screencapture').append('<video class="rounded centered" id="screenvideo" width="100%" height="100%" autoplay muted="muted"/>');
				}
				attachMediaStream($('#screenvideo').get(0), stream);
			},
			oncleanup: function() {
				console.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
			}
		});
}
