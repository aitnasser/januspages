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
var mixertest = null;
var started = false;
var spinner = null;

var myusername = null;
var myid = null;
var audioenabled = false;


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
						// Attach to Audio Bridge test plugin
						janus.attach(
							{
								plugin: "janus.plugin.audiobridge",
								success: function(pluginHandle) {
									$('#details').remove();
									mixertest = pluginHandle;
									console.log("Plugin attached! (" + mixertest.getPlugin() + ", id=" + mixertest.getId() + ")");
									// Prepare the username registration
									$('#audiojoin').removeClass('hide').show();
									$('#registernow').removeClass('hide').show();
									$('#register').click(registerUsername);
									$('#username').focus();
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
										// Darken screen and show hint
										$.blockUI({ 
											message: '<div><img src="up_arrow.png"/></div>',
											css: {
												border: 'none',
												padding: '15px',
												backgroundColor: 'transparent',
												color: '#aaa',
												top: '10px',
												left: (navigator.mozGetUserMedia ? '-100px' : '300px')
											} });
									} else {
										// Restore screen
										$.unblockUI();
									}
								},
								onmessage: function(msg, jsep) {
									console.log(" ::: Got a message :::");
									console.log(JSON.stringify(msg));
									var event = msg["audiobridge"];
									console.log("Event: " + event);
									if(event != undefined && event != null) {
										if(event === "joined") {
											// Successfully joined, negotiate WebRTC now
											myid = msg["id"];
											console.log("Successfully joined room " + msg["room"] + " with ID " + myid);
											// Publish our stream
											mixertest.createOffer(
												{
													media: { video: false},	// This is an audio only room
													success: function(jsep) {
														console.log("Got SDP!");
														console.log(jsep);
														var publish = { "request": "configure", "audio": true };
														mixertest.send({"message": publish, "jsep": jsep});
													},
													error: function(error) {
														console.log("WebRTC error:");
														console.log(error);
														bootbox.alert("WebRTC error... " + JSON.stringify(error));
													}
												});
											// Any room participant?
											if(msg["participants"] !== undefined && msg["participants"] !== null) {
												var list = msg["participants"];
												console.log("Got a list of participants:");
												console.log(list);
												for(var f in list) {
													var id = list[f]["id"];
													var display = list[f]["display"];
													var muted = list[f]["muted"];
													console.log("  >> [" + id + "] " + display + " (muted=" + muted + ")");
													if($('#rp'+id).length === 0) {
														// Add to the participants list
														$('#list').append('<li id="rp'+id+'" class="list-group-item">'+display+' <i class="fa fa-microphone-slash"></i></li>');
														$('#rp'+id + ' > i').hide();
													}
													if(muted === true || muted === "true")
														$('#rp'+id + ' > i').removeClass('hide').show();
													else
														$('#rp'+id + ' > i').hide();
												}
											}
										} else if(event === "destroyed") {
											// The room has been destroyed
											console.log("The room has been destroyed!");
											bootbox.alert(error, function() {
												window.location.reload();
											});
										} else if(event === "event") {
											if(msg["participants"] !== undefined && msg["participants"] !== null) {
												var list = msg["participants"];
												console.log("Got a list of participants:");
												console.log(list);
												for(var f in list) {
													var id = list[f]["id"];
													var display = list[f]["display"];
													var muted = list[f]["muted"];
													console.log("  >> [" + id + "] " + display + " (muted=" + muted + ")");
													if($('#rp'+id).length === 0) {
														// Add to the participants list
														$('#list').append('<li id="rp'+id+'" class="list-group-item">'+display+' <i class="fa fa-microphone-slash"></li>');
														$('#rp'+id + ' > i').hide();
													}
													if(muted === true || muted === "true")
														$('#rp'+id + ' > i').removeClass('hide').show();
													else
														$('#rp'+id + ' > i').hide();
												}
											}
											// Any new feed to attach to?
											if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
												// One of the participants has gone away?
												var leaving = msg["leaving"];
												console.log("Participant left: " + leaving + " (we have " + $('#rp'+leaving).length + " elements with ID #rp" +leaving + ")");
												$('#rp'+leaving).remove();
											}
										}
									}
									if(jsep !== undefined && jsep !== null) {
										console.log("Handling SDP as well...");
										console.log(jsep);
										mixertest.handleRemoteJsep({jsep: jsep});
									}
								},
								onlocalstream: function(stream) {
									console.log(" ::: Got a local stream :::");
									console.log(JSON.stringify(stream));
									// We're not going to attach the local audio stream
									$('#audiojoin').hide();
									$('#room').removeClass('hide').show();
									$('#participant').removeClass('hide').html(myusername).show();
								},
								onremotestream: function(stream) {
									$('#room').removeClass('hide').show();
									if($('#roomaudio').length === 0) {
										$('#mixedaudio').append('<video class="rounded centered" id="roomaudio" width="100%" height="100%" autoplay/>');
									}
									attachMediaStream($('#roomaudio').get(0), stream);
									// Mute button
									audioenabled = true;
									$('#toggleaudio').click(
										function() {
											audioenabled = !audioenabled;
											if(audioenabled)
												$('#toggleaudio').html("Mute").removeClass("btn-success").addClass("btn-danger");
											else
												$('#toggleaudio').html("Unmute").removeClass("btn-danger").addClass("btn-success");
											mixertest.send({message: { "request": "configure", "audio": audioenabled }});
										}).removeClass('hide').show();

								},
								oncleanup: function() {
									console.log(" ::: Got a cleanup notification :::");
									$('#participant').empty().hide();
									$('#list').empty();
									$('#mixedaudio').empty();
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

function checkEnter(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		registerUsername();
		return false;
	} else {
		return true;
	}
}

function registerUsername() {
	if($('#username').length === 0) {
		// Create fields to register
		$('#register').click(registerUsername);
		$('#username').focus();
	} else {
		// Try a registration
		$('#username').attr('disabled', true);
		$('#register').attr('disabled', true).unbind('click');
		var username = $('#username').val();
		if(username === "") {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html("Insert your display name (e.g., pippo)");
			$('#username').removeAttr('disabled');
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
		if(/[^a-zA-Z0-9]/.test(username)) {
			$('#you')
				.removeClass().addClass('label label-warning')
				.html('Input is not alphanumeric');
			$('#username').removeAttr('disabled').val("");
			$('#register').removeAttr('disabled').click(registerUsername);
			return;
		}
		var register = { "request": "join", "room": 1234, "display": username };
		myusername = username;
		mixertest.send({"message": register});
	}
}
