/**
  Monroe&Pressing phase space visualization with WebGL.
  
  \date October 2013
  \author Max Hermann (http://www.386dx25.de)
*/
"use strict";

//------------------------------------------------------------------------------
//  demo
//------------------------------------------------------------------------------
var DEMO = {
	lines     : new IlluminatedLines2(),
	mat_proj  : mat4.create(), 
	mat_model : mat4.create(),
	phaseShift : 42,
	phaseScale : 10.0,
	audio : null,	
	preset : 'phasespace',	
	cameraPos : [0, 0, -5],
	rotateCamera : 1,
	framecount : 0,
	lastUpdateFrame : 0,
	doAudioTemporalSmoothing : 0,
	doAudioLowPass : 1,	
	bgcolor : [0.0, 0.0, 0.0],

	//-------------------------------------------------------------------------
	//  audio embedding
	//-------------------------------------------------------------------------
	
	embedMonroPressing : function( buffer ) {
		// phase space embedding
		var phaseShift = DEMO.phaseShift,
		    phaseScale = DEMO.phaseScale,
		    DIM = 3, // dimensionality of visualization
		    numUsableSamples = buffer.length - (DIM-1)*phaseShift,
		    ofs = 0;
		
		// WORKAROUND: The second half of the samples seems to be zero, maybe
		//             because the second (stereo) channel is not present in 
		//             our music (after-work.ogg)?
		numUsableSamples = Math.floor(numUsableSamples / 2);		
		
		var verts = new Float32Array( numUsableSamples*DIM );
		for( var i=0; i < numUsableSamples; i++ ) {
			for( var d=0; d < DIM; d++, ofs++ ) {
				
				// assume normalized samples in [-1,1]
				var v = buffer[i+ d * phaseShift];
				
				// convert to decibels (could as well be done beforehand)
				var sign = (v > 0.0) ? 1.0 : -1.0;
				v = Math.log(1.0 + Math.abs(v));
				
				verts[ofs] = sign * phaseScale * v;
			}
		}
		
		// update UI
		var numsamples_element = document.getElementById("numsamples");
		if( numsamples_element ) numsamples_element.value = numUsableSamples;		

		return verts;
	},	
	
	embedOscilloscope : function( buffer ) {
		var verts = new Float32Array( buffer.length * 3 );
		for( var i=0; i < buffer.length; i++ ) {
			var di = i / (1.*buffer.length-1.);
			verts[i*3+0] = 2.*di-1.;
			verts[i*3+1] = buffer[i];
			verts[i*3+2] = 0.;
		}
		return verts;
	},
	
	//-------------------------------------------------------------------------
	//  audio processing
	//-------------------------------------------------------------------------	
	
	filterBox : function( buffer, kernelWidth ) {
	
		var filtered = new Float32Array( buffer.length - kernelWidth );
		
		var sum = 0.0;
		for( var i=0; i < kernelWidth; i++ ) {
			sum = sum + buffer[i];
		}
		filtered[0] = sum * (1.0/kernelWidth);

		var dw = kernelWidth/2;
		for( var i=1; i < buffer.length-kernelWidth; i++ ) {
			sum = sum - buffer[i-1];
			sum = sum + buffer[i+kernelWidth];
			filtered[i] = sum * (1.0/kernelWidth);
		}
		
		return filtered;
	},	
	
	ringBuffers : new Array(5),
	
	smoothBuffers : function( buffer ) {

		var copy = function( dst, src ) {
			for( var i=0; i < dst.length; i++ )
				dst[i] = src[i];
		}
		
		var ring = DEMO.ringBuffers;
		var k = ring.length;
		for( var b=0; b < k-1; b++ ) {
			if( !ring[b+1] ) continue;
			var len = ring[b+1].length;
			if( !ring[b] )				ring[b] = new Float32Array( len );
			if( ring[b].length != len )	ring[b] = new Float32Array( len );
			copy( ring[b], ring[b+1] );				
		}
		ring[k-1] = new Float32Array( buffer.length );
		copy( ring[k-1], buffer );
		
		for( var b=k-1; b >= 0; b-- )
			if( !ring[b] ) {
				APP.common.log("Ringbuffers filled up to "+b+".",1);
				return buffer;
			}
		
		var outbuf = new Float32Array( buffer.length );
		var w = 1./ring.length;
		for( var i=0; i < buffer.length; i++ ) {
			outbuf[i] = 0.0;
			for( var b=0; b < ring.length; b++ ) {
				outbuf[i] += w * ring[b][i];
			}
			// countermeasure against the artifical dampening
			outbuf[i] *= k/2;
		}
		
		return outbuf;
	},

	// We keep a copy of the last audio buffer to allow switching between
	// phase space and oscilloscope also when audio playback is paused.
	lastBuffer : null,
	
	setBuffer : function( buffer ) {
		if( !buffer ) return;
		DEMO.lastBuffer = new Float32Array( buffer.length );
		
		var copy = function( dst, src ) {
			for( var i=0; i < dst.length; i++ )
				dst[i] = src[i];
		}
		
		copy( DEMO.lastBuffer, buffer );
		
		// temporal smoothing
		if( DEMO.doAudioTemporalSmoothing )
			buffer = DEMO.smoothBuffers( buffer );
		
		// low pass filter (approximated by fast box convolution)
		if( DEMO.doAudioLowPass )
			buffer = DEMO.filterBox( buffer, 13 );
		
		// turn audio buffer into 3D vertex stream
		switch( DEMO.preset ) {
		default:
		case 'phasespace':
			var verts = DEMO.embedMonroPressing( buffer );
			break;
		case 'oscilloscope':
			var verts = DEMO.embedOscilloscope( buffer );
			break;		
		}

		// update illuminated lines renderer
		DEMO.lines.setData( verts );
	},
	
	onUpdatedAudioSignal : function( buffer ) {

		if( DEMO.audio )
			if( DEMO.audio.paused ) return;
		
		// limit update frequency to a fraction of the fps
		if( (DEMO.framecount - DEMO.lastUpdateFrame) < 1 )
			return;
		DEMO.lastUpdateFrame = DEMO.framecount;
		
		DEMO.setBuffer( buffer );		
	},	
	
	//-------------------------------------------------------------------------
	//  presets
	//-------------------------------------------------------------------------	
	
	setPreset : function( preset ) {
		DEMO.preset = preset;
		switch( preset ) {
		default:
		case 'phasespace':
			DEMO.lines.setLineWidth( 0.07 );
			DEMO.lines.mode = DEMO.lines.modes.FANCY;
			DEMO.lines.colorAmbient = [.1,.2,.3,1.];
			DEMO.cameraPos = [0, 0, -8];
			DEMO.rotateCamera = 1;
			DEMO.setBuffer( DEMO.lastBuffer );
			break;
			
		case 'oscilloscope':
			DEMO.lines.setLineWidth( 0.001 );
			DEMO.lines.mode = DEMO.lines.modes.PLAIN_UNLIT;
			DEMO.lines.colorAmbient = [1.,1.,1.,1.];
			DEMO.cameraPos = [0, 0, -1];
			DEMO.rotateCamera = 0;
			DEMO.setBuffer( DEMO.lastBuffer );
			break;
			
		case 'tubes':
			DEMO.lines.mode = DEMO.lines.modes.PLAIN;
			DEMO.lines.colorAmbient = [.5,.5,.5,1.];
			DEMO.lines.setLineWidth( 0.1 );
		}		

		DEMO.updateUI();
	},
	
	getPresetID : function( preset ) {
		switch( preset ) {
		default:
		case 'phasepace'   : return 0;
		case 'oscilloscope': return 1;
		case 'tubes'       : return 2;
		}
		return 0;
	},
	
	//-------------------------------------------------------------------------
	//  UI
	//-------------------------------------------------------------------------
	
	ui : {},
	
	initUI : function() {
		DEMO.ui.linewidth     = document.getElementById("demoui.linewidth");
		DEMO.ui.pointsize     = document.getElementById("demoui.pointsize");
		DEMO.ui.lowpassfilter = document.getElementById("demoui.lowpassfilter");
		DEMO.ui.preset        = document.getElementById("demoui.preset");
		DEMO.ui.mode          = document.getElementById("demoui.mode");
		DEMO.ui.ambient       = document.getElementById("demoui.ambient");
		DEMO.ui.specular      = document.getElementById("demoui.specular");
		DEMO.ui.phaseshift    = document.getElementById("demoui.phaseshift");
		DEMO.ui.phasescale    = document.getElementById("demoui.phasescale");
		DEMO.ui.bgcolor       = document.getElementById("demoui.bgcolor");
	},
	
	onUIChange : function() {		
		if( DEMO.ui.linewidth  ) DEMO.lines.setLineWidth( DEMO.ui.linewidth.value );		
		if( DEMO.ui.pointsize  ) DEMO.lines.setPointSize( DEMO.ui.pointsize.value );
		if( DEMO.ui.mode       ) DEMO.lines.mode = DEMO.ui.mode.selectedIndex;		
		if( DEMO.ui.phaseshift ) DEMO.phaseShift = DEMO.ui.phaseshift.value;		
		if( DEMO.ui.phasescale ) DEMO.phaseScale = DEMO.ui.phasescale.value;
		if( DEMO.ui.lowpassfilter ) DEMO.doAudioLowPass = DEMO.ui.lowpassfilter.checked;
		
		// some parameter changes require re-embedding the last sound buffer
		DEMO.setBuffer( DEMO.lastBuffer );			
	},
	
	onUIPreset : function() {
		if( DEMO.ui.preset ) 
			DEMO.setPreset( DEMO.ui.preset.options[ DEMO.ui.preset.selectedIndex ].text );
	},
	
	setRGBAfromRGB : function( color4, rgb ) {
		color4[0] = rgb[0];
		color4[1] = rgb[1];
		color4[2] = rgb[2];
	},
	
	onUIColorAmbient : function( color ) {
		DEMO.setRGBAfromRGB( DEMO.lines.colorAmbient, color.rgb );
	},

	onUIColorSpecular : function( color ) {
		DEMO.setRGBAfromRGB( DEMO.lines.colorSpecular, color.rgb );
	},
	
	onUIColorBackground : function( color ) {
		DEMO.bgcolor = color.rgb;
	},

	updateUI : function() {
		if( DEMO.ui.linewidth     ) DEMO.ui.linewidth.value       = DEMO.lines.getLineWidth();
		if( DEMO.ui.pointsize     ) DEMO.ui.pointsize.value       = DEMO.lines.getPointSize();
		if( DEMO.ui.lowpassfilter ) DEMO.ui.lowpassfilter.checked = DEMO.doAudioLowPass;
		if( DEMO.ui.preset        ) DEMO.ui.preset.selectedIndex  = DEMO.getPresetID( DEMO.preset );
		if( DEMO.ui.mode          ) DEMO.ui.mode.selectedIndex    = DEMO.lines.mode;
		if( DEMO.ui.ambient       ) DEMO.ui.ambient.color.fromRGB( DEMO.lines.colorAmbient[0], DEMO.lines.colorAmbient[1], DEMO.lines.colorAmbient[2] );
		if( DEMO.ui.specular      ) DEMO.ui.specular.color.fromRGB( DEMO.lines.colorSpecular[0], DEMO.lines.colorSpecular[1], DEMO.lines.colorSpecular[2] );
		if( DEMO.ui.bgcolor       ) DEMO.ui.bgcolor.color.fromRGB( DEMO.bgcolor[0], DEMO.bgcolor[1], DEMO.bgcolor[2] );
		if( DEMO.ui.phaseshift    ) DEMO.ui.phaseshift.value = DEMO.phaseShift;
		if( DEMO.ui.phasescale    ) DEMO.ui.phasescale.value = DEMO.phaseScale;
	},

	//-------------------------------------------------------------------------
	//  init()
	//-------------------------------------------------------------------------

	init : function() {
		DEMO.setPreset( DEMO.preset );
		DEMO.initUI();
		DEMO.updateUI();
	},
	
	mouseMode : 'none'	
};

//-------------------------------------------------------------------------
//  mouse interaction
//-------------------------------------------------------------------------

APP.core.handleMouseDown = function( e ) {
	APP.mouse.handleDown( e );	
	if( APP.mouse.buttonDown[0] ) DEMO.mouseMode = 'zoom';
	if( e.which == 2 ) // middle
		DEMO.cameraPos[2] = (DEMO.preset == 'oscilloscope') ? -1 : -8;	
},

APP.core.handleMouseUp = function( e ) {
	APP.mouse.handleUp( e );
	DEMO.mouseMode = 'none';
},

APP.core.handleMouseMove = function( e ) {
	APP.mouse.handleMove( e );
	
	if( DEMO.mouseMode == 'zoom' ) {
		DEMO.cameraPos[2] += APP.mouse.delta[1] / 100.0;
	}
}

//------------------------------------------------------------------------------
//  init()
//------------------------------------------------------------------------------
APP.core.init = function() {
	// setup IlluminatedLines2	
	DEMO.lines.deblog = APP.common.log;
	DEMO.lines.setup( APP.core.gl );
	DEMO.lines.setData( APP.geometry.createLorentzAttractor(500) );
	
	DEMO.init();	
	
	DEMO.setPreset('phasespace');
}

//------------------------------------------------------------------------------
//  render()
//------------------------------------------------------------------------------
APP.core.render = function() {
	let gl = APP.core.gl;
	
    // projection matrix
    let aspect = gl.viewportWidth / gl.viewportHeight;
	mat4.perspective( 45, aspect, 1, 200, DEMO.mat_proj );	
    
	var ti = ((APP.time.elapsed*1000) % 1000) / 1000.0;
	gl.viewport( 0, 0, gl.viewportWidth, gl.viewportHeight );
	gl.clearColor( DEMO.bgcolor[0], DEMO.bgcolor[1], DEMO.bgcolor[2], 1.0 );
	gl.clear( gl.COLOR_BUFFER_BIT );
	
	// camera
	mat4.identity ( DEMO.mat_model );
	mat4.translate( DEMO.mat_model, DEMO.cameraPos );
	if( DEMO.rotateCamera )
		mat4.rotate( DEMO.mat_model, APP.time.elapsed * Math.PI/5.0, [0, 1, 0] );
	
	// render demo scene
	DEMO.lines.setModelView ( DEMO.mat_model );	
	DEMO.lines.setProjection( DEMO.mat_proj  );	
	DEMO.lines.render();
	DEMO.framecount++;
}
