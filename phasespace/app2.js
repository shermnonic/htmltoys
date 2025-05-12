/**
  Minimalistic WebGL application framework APP.
  
  This file provides the following basic components:

	APP.common	- common functions like log and error handling
	APP.io		- io helpers
	APP.time	- timing 
	APP.engine	- WebGL engine
	APP.mouse	- mouse handling
	APP.core	- application logic
	
  To use this framework implement the following interface functions:
  
	APP.core.update()
	APP.core.render()
	APP.core.init()
	APP.core.handleMouseDown()
	APP.core.handleMouseUp()
	APP.core.handleMouseMove()

  \date October 2013
  \author Max Hermann (https://386dx25.de)
*/
 
/// Provides requestAnimationFrame in a cross browser way.
/// See https://www.khronos.org/registry/webgl/sdk/demos/common/webgl-utils.js
window.requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
           return window.setTimeout(callback, 1000/60);
         };
})();

// The nice APP concept is stolen from https://gist.github.com/greypants/3739036
window.APP = window.APP || {};
	
APP.common = {
	
	name     : "Demo",	
	loglevel : 1,	

	/// Custom debug log
	log : function( txt, lvl ) {
		if( lvl <= APP.common.loglevel )
			console.log( "["+lvl+"] "+txt );
	},

	/// Custom error reporting function	
	throwError : function( msg ) {
		alert( msg );
	}	
};

APP.io = {
	
	/// Return text given under specific HTML element
	getTextAt : function( docEl ) {
		var text = "";
		var cur = docEl.firstChild;
		while( cur ) {
			if( cur.nodeType == cur.TEXT_NODE )
				text += cur.textContent;
			cur = cur.nextSibling;
		}
		return text;
	},
	
	/// Return text from specified file url, found here:
	/// http://www.khronos.org/message_boards/showthread.php/7170-How-to-include-shaders
	/// More complete asynchronous function can is given here:
	/// http://stackoverflow.com/questions/4878145/javascript-and-webgl-external-scripts
	getSourceSynch : function( url ) {
	  var req = new XMLHttpRequest();
	  req.open("GET", url, false);
	  req.send(null);
	  return (req.status == 200) ? req.responseText : null;
	}
	
};

// Adapted from a nice article on time based animation: 
// https://gist.github.com/greypants/3739036
APP.time = {
	
	launched : Date.now(),
	
	setDelta : function() {
		APP.time.now   = Date.now();
		APP.time.delta = (APP.time.now - APP.time.then) / 1000.0; 
		APP.time.then  = APP.time.now;
		APP.time.elapsed = (APP.time.now - APP.time.launched) / 1000.0;
	}
}

APP.engine = {

	/// Create and compile GLSL shader from source
	compileShader : function( gl, type, source ) {
		var shader = gl.createShader( type );
		gl.shaderSource ( shader, source );
		gl.compileShader( shader );
		if( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
			APP.common.throwError( "Error compiling GLSL shader:\n"+gl.getShaderInfoLog( shader ) );
			return null;
		}
		APP.common.log( "shader="+shader, 3 );
		return shader;
	},
	
	/// Return compiled GLSL shader given under specific HTML element id
	getShader : function( gl, id ) {
		// get shader element 
		var sourceEl = document.getElementById( id ) ;
		APP.common.log( sourceEl, 3 );
		// ... and source code
		var source = APP.io.getTextAt( sourceEl );	
		APP.common.log( source, 3 );
		
		// detect shader type
		var type;
		if( sourceEl.type == "x-shader/x-vertex" )
			type = gl.VERTEX_SHADER;
		else 
		if( sourceEl.type == "x-shader/x-fragment" )
			type = gl.FRAGMENT_SHADER;
		else {
			APP.common.throwError( "Error: Unknown shader type \""+ sourceEl.type + "\"" );
			return null;
		}
		APP.common.log( "shader type="+type+" (VERTEX_SHADER="+gl.VERTEX_SHADER+", FRAGMENT_SHADER="+gl.FRAGMENT_SHADER+")", 3 );
		
		// load & compile shader		
		return compileShader( gl, type, source );
	},	
	
	/// Return compiled GLSL shader loaded from given URL
	loadShader : function( gl, url, type ) {
		return compileShader( gl, type, getSourceSynch( url ) );
	},

	handleTextureLoaded : function( gl, tex ) {
		gl.bindTexture( gl.TEXTURE_2D, tex );
		gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.image );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );  	
		gl.bindTexture( gl.TEXTURE_2D, null );
	},

	loadTexture : function( gl, src ) {
		var tex = gl.createTexture();
		tex.image = new Image();
		tex.image.onload = function() { APP.engine.handleTextureLoaded( gl, tex ); }
		tex.image.src = src;
		return tex;
	},
	
	// Non-invasive framerate counter from Evgeny Demidov 
	// http://www.ibiblio.org/e-notes/webgl/gpu/contents.htm
	nextFPSCount  : 20,
	lastFrameTime : Date.now(),
	framerate : function() {
		if( --APP.engine.nextFPSCount<= 0 ) {
			var ti = new Date().getTime();
			var fps = Math.round(200000/(ti - APP.engine.lastFrameTime)) / 10;
			  
			// Update DOM element
			var fps_element = document.getElementById("framerate");
			if( fps_element ) fps_element.value = fps;		
			APP.engine.nextFPSCount  = 20;
			APP.engine.lastFrameTime = ti;
		}
	}	
};

/// Some convenience functionality for handling mouse input
APP.mouse = {
	buttonDown : [false,false,false],
	lastPos    : [0,0],
	delta      : [0,0],
	
	// cross-browser mouse button detection 
	// (taken from http://javascript.info/tutorial/mouse-events)
	fixWhich : function( e ) {
		if (!e.which && e.button) {
			if      (e.button & 1) e.which = 1 // Left
			else if (e.button & 4) e.which = 2 // Middle
			else if (e.button & 2) e.which = 3 // Right
		}	
	},
	
	handleDown : function( e ) {
		APP.mouse.fixWhich( e );
		APP.mouse.buttonDown[ e.which-1 ] = true;
		APP.lastPos = [ e.clientX, e.clientY ];
	},

	handleUp : function( e ) {		
		// Workaround: Reset all buttons.
		//APP.mouse.buttonDown = [false,false,false];
		// was: 
			APP.mouse.fixWhich( e );
			APP.mouse.buttonDown[ e.which-1 ] = false;		
	},

	handleMove : function( e ) {
		APP.mouse.delta[0] = e.clientX - APP.mouse.lastPos[0];
		APP.mouse.delta[1] = e.clientY - APP.mouse.lastPos[1];
		
		APP.mouse.lastPos[0] = e.clientX;
		APP.mouse.lastPos[1] = e.clientY;
	}
};

APP.core = {

	state : 'animate',
	
	/// Animation callback, bundles all calls to generate a frame
	frame : function() {
		switch( APP.core.state ) {
			default:
			case 'animate':
				APP.time.setDelta();
				APP.core.update();
				APP.core.render();
				APP.engine.framerate();
			
				requestAnimFrame( APP.core.frame, APP.core.canvas );
			
			case 'paused':
				// nop
		}
	},
	
	///@{ Interface
	
	update : function() {	},
	
	render : function() {	},
	
	init   : function() {	},
	
	handleMouseDown : function( e ) {	},	
	handleMouseUp   : function( e ) {	},	
	handleMouseMove : function( e ) {	}	
	///@}
};

APP.setup = function( canvasID ) {
	// initialize WebGL
	var canvas = window.document.getElementById( canvasID );
	try {
		APP.core.gl = canvas.getContext("webgl") ? canvas.getContext("webgl") : canvas.getContext("experimental-webgl");
		APP.core.gl.viewportWidth = canvas.width;
		APP.core.gl.viewportHeight= canvas.height;
		APP.core.canvas = canvas;
		APP.common.log( "gl="+APP.core.gl+", width="+canvas.width+", height="+canvas.height, 2 );
	} catch(e) {
		APP.common.log( "Catched error in APP.setup(): "+e, 1 )
	}
	if( !APP.core.gl ) {
		APP.common.throwError("Error: WebGL context unavailable!");
	}
	
	// mouse callbacks
	canvas.onmousedown = APP.core.handleMouseDown;
	window.onmouseup   = APP.core.handleMouseUp;
	window.onmousemove = APP.core.handleMouseMove;
};
