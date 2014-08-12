var server = "ws://" + "192.168.0.14" + ":8188";
var janus = null;
var streaming = null;
var started = false;
var spinner = null;

var selectedStream = null;

$(document).ready(function () {
  // Initialize the library (console debug enabled)
  Janus.init({ debug: true, callback: function () {
    // Use a button to start the demo
    $('#start').click(function () {
      if (started)
        return;
      started = true;
      $(this).attr('disabled', true).unbind('click');
      // Make sure the browser supports WebRTC
      if (!Janus.isWebrtcSupported()) {
        bootbox.alert("No WebRTC support... ");
        return;
      }
      // Create session
      janus = new Janus(
				{
				  server: server,
				  success: function () {
				    janus.attach(
							{
							  plugin: "janus.plugin.bidirectionalstreaming",
							  success: function (pluginHandle) {
							    $('#details').remove();
							    streaming = pluginHandle;
							    console.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
							    streaming.createOffer(
                    {
                      success: function (jsep) {
                        var body = { "request": "start", "mode": 2 };
                        streaming.send({ "message": body, "jsep": jsep });
                      },
                      error: function (error) {
                        alert(error);
                      }
                    }
                  );
							    $('#start').removeAttr('disabled').html("Stop")
										.click(function () {
										  $(this).attr('disabled', true);
										  clearInterval(bitrateTimer);
										  janus.destroy();
										});
							  },
							  error: function (error) {
							    console.log("  -- Error attaching plugin... " + error);
							    bootbox.alert("Error attaching plugin... " + error);
							  },
							  onmessage: function (msg, jsep) {
							    if (jsep !== undefined && jsep !== null) {
							      console.log(jsep);
							      streaming.handleRemoteJsep({ jsep: jsep });
							    }
							  },
							  consentDialog: function (on) {
							    console.log("Consent dialog should be " + (on ? "on" : "off") + " now");
							    if (on) {
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
							        }
							      });
							    } else {
							      // Restore screen
							      $.unblockUI();
							    }
							  },
							  onremotestream: function (stream) {
							    console.log(" ::: Got a remote stream :::");
							    console.log(JSON.stringify(stream));
							    attachMediaStream($('#remotevideo').get(0), stream);
							  },
							  onlocalstream: function (stream) {
							    console.log(" ::: Got a local stream :::");
							    console.log(JSON.stringify(stream));
							    attachMediaStream($('#myvideo').get(0), stream);
							    $("#myvideo").get(0).muted = "muted";
							  },
							  oncleanup: function () {
							    console.log(" ::: Got a cleanup notification :::");
							    $('#remotevideo').remove();
							  }
							});
				  },
				  error: function (error) {
				    console.log(error);
				    bootbox.alert(error, function () {
				      window.location.reload();
				    });
				  },
				  destroyed: function () {
				    window.location.reload();
				  }
				});
    });
  }
  });
});