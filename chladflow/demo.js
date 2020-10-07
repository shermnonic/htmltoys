"use strict";
// Shadertoy wrapper based on app2.js
// www.386dx25.de 2019

// TODO: Avoid polluting global namespace!
var vbo, nbo, tbo;
var program;
var loc_vpos;

var verts = new Float32Array(
	[-1,-1,
	 -1, 1,
	  1,-1,
	  1, 1 ]);
		 
var DEMO = {	
	initGL : function( gl ) {
		var compileShader = APP.engine.compileShader;
		
		// We could also put the shader source into a script tag, e.g. see https://blog.mayflower.de/4584-Playing-around-with-pixel-shaders-in-WebGL.html
		var vertexShaderSource = '\
attribute vec3 vpos; \n\
attribute float tc; \n\
void main() {\n\
	gl_Position = vec4(vpos,1.0);\n\
}\n\
\n';
		var fragmentShaderPreamble = '\n\
precision mediump float;\n\
\n\
uniform vec2	iResolution; \n\
uniform float	iTime;\n\
uniform vec4	iMouse;\n\
\n';
		var fragmentShaderMain = '\n\
void main() {\n\
	vec4 fragColor=vec4(0.0);\n\
	vec2 fragCoord=gl_FragCoord.xy;\n\
	mainImage(fragColor,fragCoord);\n\
    //vec2 uv = fragCoord/iResolution.xy;\n\
    //vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));\n\
    //fragColor = vec4(col,1.0);\n\
	gl_FragColor = fragColor;\n\
}\n\
\n';
		var fragmentShaderToyDefault =
'\n\
void mainImage( out vec4 fragColor, in vec2 fragCoord ) { \n\
    vec2 uv = fragCoord/iResolution.xy;\n\
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));\n\
    fragColor = vec4(col,1.0);\n\
}\n\
\n';
		var fragmentShaderToy = fragmentShaderToyDefault;
		
		if( window.document.getElementById("shadertoy") )
			fragmentShaderToy = window.document.getElementById("shadertoy").text;

		var fragmentShaderSource = 
				  fragmentShaderPreamble 
				+ fragmentShaderToy 
				+ fragmentShaderMain;

		// compile shaders, link program
		var vshader = compileShader(gl,gl.VERTEX_SHADER, vertexShaderSource);
		var fshader = compileShader(gl,gl.FRAGMENT_SHADER, fragmentShaderSource);
		program = gl.createProgram();
		gl.attachShader(program, vshader);
		gl.attachShader(program, fshader);
		gl.linkProgram(program);
		
		// get attribute/uniform locations
		loc_vpos  = gl.getAttribLocation( program, 'vpos'  );
		
		// create buffer objects 
		vbo = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
		gl.bufferData( gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW );
		
		// vertex attribute
		gl.vertexAttribPointer    ( loc_vpos, 2, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( loc_vpos );
		
		// default state
		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.CULL_FACE );
	},
	
	renderGL : function( gl, time ) {
		gl.useProgram( program );
		gl.uniform1f( gl.getUniformLocation(program,'iTime'), time );
		gl.uniform2fv( gl.getUniformLocation(program,'iResolution'),
			[APP.core.gl.viewportWidth, APP.core.gl.viewportHeight] );
		gl.uniform4fv( gl.getUniformLocation(program,'iMouse'),
			[APP.mouse.lastPos[0],APP.mouse.lastPos[1],0.,0.]);
    
    DEMO.updateCustomUniforms(gl,program);
    
		gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
		gl.drawArrays( gl.TRIANGLE_STRIP, 0, verts.length/2 );
	},
  
  // interface
  updateCustomUniforms : function( gl, program ) {
  }
};


APP.core.init = function() {
	DEMO.initGL( APP.core.gl );
}

APP.core.render = function() {
	var gl = APP.core.gl;
	var ti = APP.time.elapsed;
	
	gl.clearColor( 1.0,0.0,0.0, 1.0 );
	gl.clear( gl.COLOR_BUFFER_BIT );
		
	DEMO.renderGL( gl, ti );
	DEMO.framecount++;
}