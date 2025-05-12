/**
  Minimalistic HTML5 Audio library.
  
  \date November 2012
  \author Max Hermann (https://386dx25.de)
*/

function createAudioIO( audioEl ) {
	var audioio = null;
	try {
		audioio = new AudioIO_webkit( audioEl );
	} catch( e ) {
		console.log(e.message);
		console.log('Trying to fall back to Mozilla Audio API');
		audioio = new AudioIO_moz( audioEl );
	}
	return audioio;
}

/// AudioIO interface for Mozilla Audio Data
/// For documentation and example source code see: 
///  	https://wiki.mozilla.org/Data_API
AudioIO_moz = function( audioEl ) {	
	var audio = audioEl,
	    channels, 
	    rate, 
	    frameBufferLength,		
		self = this;
	
	this.callback = null;
	
	this.loadedMetadata = function() {		
		//deblog('loadedMetadata()',1);
		channels          = audio.mozChannels;
		rate              = audio.mozSampleRate; /* unused */
		frameBufferLength = audio.mozFrameBufferLength;
	}	

	this.audioAvailable = function(event) {
		var fb = event.frameBuffer,
			t  = event.time, /* unused, but it's there */
			signal = new Float32Array(fb.length / channels),
			len = Math.min( fb.length, frameBufferLength );		
		
		if( channels==2 ) {
			// Assuming interlaced stereo channels,
			// need to split and merge into a stero-mix mono signal
			for (var i = 0, fbl = len / 2; i < fbl; i++ ) {
				signal[i] = (fb[2*i] + fb[2*i+1]) / 2;
			}
		}
		else {
			// Copy signal 1:1, e.g. for mono signal
			for( var i=0; i < len; i++ ) {
				signal[i] = fb[i];
			}
		}
		
		// Update external processing
		if( self.callback )
			self.callback( signal );
	}
	
	this.onload = function() {
		audio.addEventListener('MozAudioAvailable', self.audioAvailable, false);	
	}
	
	// c'tor
	audio.addEventListener('loadedmetadata', self.loadedMetadata, false);	
}


/// AudioIO interface for Webkit Web Audio
/* 
Web audio articles and links:

- Can I use Web Audio API? Compatibility table.
	http://caniuse.com/audio-api
- Google demos:
  http://chromium.googlecode.com/svn/trunk/samples/audio/index.html
	- My favourite one "Realtime Analyser":
	  http://chromium.googlecode.com/svn/trunk/samples/audio/visualizer-gl.html
- Nice introductory tutorial at creativejs:
  http://creativejs.com/resources/web-audio-api-getting-started/ 
- More complete tutorial at html5rocks:
  http://www.html5rocks.com/en/tutorials/webaudio/games
	- Stream from <audio> article at html5rocks:
	  http://updates.html5rocks.com/2012/02/HTML5-audio-and-the-Web-Audio-API-are-BFFs
	- Live web audio:
	  http://updates.html5rocks.com/2012/09/Live-Web-Audio-Input-Enabled
- Nice demo:
	http://html5-demos.appspot.com/static/webaudio/createMediaSourceElement.html
*/
AudioIO_webkit = function( audioEl ) {
	var self = this;	
	this.callback = null;
	
	var context, soundSource, soundBuffer,
		soundProcessor; // custom sound processing node (pure sink)
	
	initAudio();

	// Create audio context
	function initAudio() {
		if (typeof AudioContext == "function") {
			context = new AudioContext();
		} else if (typeof webkitAudioContext == "function") {
			context = new webkitAudioContext();
		} else {
			throw new Error('AudioContext not supported. :(');
		}
		// Above lines could probably be simplified to
		//   window.AudioContext = window.AudioContext || window.webkitAudioContext;
		//   context = new AudioContext();
		// and checking for null result?
	}

	function startAudioFromTag( audioEl ) {
		var mediaSourceNode = context.createMediaElementSource( audioEl );
		createAudioGraph( mediaSourceNode );
	}
	
	var mediaStreamSource;
	
	function gotStream( stream ) {
		console.log("adioio.gotStream()");
		
		// Create an AudioNode from the stream.
		mediaStreamSource = context.createMediaStreamSource( stream );
		
		createAudioGraph( mediaStreamSource );
	}
	
	function startLiveInput() {
		console.log("adioio.startLiveInput()");
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
		navigator.getUserMedia( {audio:true, video:false}, 
			// success
			gotStream,
			// failed
			function() {
				console.log('audioio: Capturing microphone audio input failed!');
			}
		);
	}
	
	function processAudio( event ) {
		var buffer = event.inputBuffer.getChannelData(0);
		//console.log('received '+buffer.length+' samples');
		
		// Update external processing
		if( self.callback )
			self.callback( buffer );		
	}

	var analyser;
	function createAudioGraph( sourceNode ) {
		// Speaker output
		sourceNode.connect( context.destination );

		// Our custom processing node
		soundProcessor = context.createScriptProcessor( 1024, 1, 1 );
		
		// Alternatively we could use an analyser node to access the waveform
		//analyser = context.createAnalyser();
		//analyser.fftSize = 2048;
		//sourceNode.connect( analyser );
		
		soundProcessor.onaudioprocess = processAudio;
		sourceNode.connect( soundProcessor );
		soundProcessor.connect( context.destination ); // dummy output
		//deblog('createAudioGraph',2);
	}

	// Wait for window.onload to fire. See crbug.com/112368
	window.addEventListener('load', function(e) {
		if( audioEl == null ) {
			// Use live audio input
			console.log("adioio: Starting live audio input");
			startLiveInput();
		}
		else {
			// Use playbacked audio from player under audio tag
			startAudioFromTag( document.querySelector('audio') );
		}
	}, false );
	
	this.onload = function() {
		// nop
	}
}
