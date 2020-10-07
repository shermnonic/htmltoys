//------------------------------------------------------------------------------
/// Illuminated lines renderer
//------------------------------------------------------------------------------
// Written by mnemonic@386dx26.de in 2012
//
// Requires that the following js libs are included already:
//  - app2.js            (for APP.common.log)
//	- gl-matrix-min.js   (for matrix operations)
//------------------------------------------------------------------------------
function IlluminatedLines2() {
	
	var vertexShaderSource = ' \n\
		attribute vec3 vpos; // current vertex 					\n\
		attribute vec3 npos; // next vertex in line strip		\n\
		attribute float tc;   // texture coordinate				\n\
		uniform highp mat4 model;								\n\
		uniform highp mat4 proj;								\n\
		uniform float pointSize;								\n\
		uniform float lineWidth; 								\n\
		varying float LT;										\n\
		varying float VT;										\n\
		varying float texcoord;									\n\
		void main()												\n\
		{														\n\
			vec3 v0 = vec3(model * vec4(vpos,1.0)),				\n\
				 v1 = vec3(model * vec4(npos,1.0));				\n\
																\n\
			vec3 lightpos = vec3(-1.0,1.0,1.0);					\n\
																\n\
			// Illuminated lines (T,L,V) coordinate system		\n\
			vec3 T = normalize( v1 - v0 );         // tangent	\n\
			vec3 L = normalize( lightpos - v0 );   // light 	\n\
			vec3 V = normalize( -v0 );             // viewer	\n\
			LT = dot(L,T);										\n\
			VT = dot(V,T);										\n\
																\n\
			// Offset duplicate vertices with tc to gain a simple quad strip \n\
			v0 += lineWidth * tc * cross( T, V );				\n\
			//v0.y += lineWidth * tc;								\n\
																\n\
			texcoord = tc;										\n\
																\n\
			gl_PointSize = pointSize;							\n\
			gl_Position = proj * vec4(v0,1.0);					\n\
		} ';
	
	var fragmentShaderSource = ' \n\
		precision mediump float; 				\n\
		varying float LT;						\n\
		varying float VT;						\n\
		varying float texcoord;					\n\
		uniform sampler2D shadingSampler;		\n\
		uniform sampler2D spriteSampler;		\n\
		uniform vec4 ambient;					\n\
		uniform vec4 specular;					\n\
		uniform bool doPointSprite;				\n\
		uniform float alpha;                    \n\
		\n\
		void main()															\n\
		{																	\n\
			vec2 tc;														\n\
			tc.x = 0.5*(clamp(LT,-1.0,1.0) + 1.0);							\n\
			tc.y = 0.5*(clamp(VT,-1.0,1.0) + 1.0);							\n\
			float phong = texture2D( shadingSampler, tc ).x;				\n\
			vec4 outColor = ambient + alpha*phong*specular; 	            \n\
			outColor *= 1.0 - abs(texcoord)*abs(texcoord);				 	\n\
			if( doPointSprite ) {											\n\
				float mask = texture2D( spriteSampler, gl_PointCoord ).x;	\n\
				outColor = (0.1 + phong*specular * 0.7) * mask;				\n\
					// was: outColor * mask;								\n\
			}																\n\
			gl_FragColor = outColor;										\n\
		} ';
	
	// c'tor	
	var self = this;
	
	// set in setup()
	var gl;
	var getTexture, compileShader;	
	
	// FIXME: The variables below should be instance specific and not global
	//        therefore we should maybe switch from "var foo" to "var self.foo".
	
	// gl vars
	var vbo, nbo, ibo, tbo,
	    program, 
		loc_vpos, loc_npos, loc_tc, loc_pointSize, loc_lineWidth, loc_alpha,
	    loc_model, loc_proj, mat_model, mat_proj,
		shadingTex, loc_shadingSampler, loc_ambient, loc_specular,
		spriteTex, loc_spriteSampler, loc_doPointSprite;
		
	// user parameters (set via setters)
	var pointSize = 64.0;
	var lineWidth = 0.10;
	var alpha = 1.0;
	
	// user parameters (set directly)
	self.colorAmbient  = [.1,.2,.3,1.];
	self.colorSpecular = [1.,1.,.7,1.];
	self.modes = {
		FANCY : 0,
		PLAIN : 1,
		PLAIN_UNLIT : 2
	};
	self.mode = self.modes.FANCY;	

	// buffer data
	var verts;
	var indices;
	var texcoords;
	
	self.setPointSize = function( size ) {
		pointSize = size;
	}

	self.getPointSize = function( size ) {
		return pointSize;
	}
	
	self.setLineWidth = function( width ) {
		lineWidth = width;
	}
	
	self.getLineWidth = function() {
		return lineWidth;
	}
	
	self.setModelView = function( matrix ) {
		mat_model = matrix;
	}
	
	self.setProjection = function( matrix ) {
		mat_proj = matrix;
	}
	
	/// Replace with your own logging function
	self.deblog = function( lvl ) {
	}
	
	/// Allocate buffers in memory and setup static indices and texcoords
	self.allocateBuffers = function( nverts ) {
		verts = new Float32Array( nverts*3 * 2 );
		
		// generic index buffer
		indices = new Uint16Array( nverts*2 );
		for( var i=0; i < nverts; i++ ) {
			// interleave between original and duplicate vertex
			indices[2*i  ] = i;
			indices[2*i+1] = nverts + i;
		}
			
		// generic texture coordinates
		texcoords = new Float32Array( nverts*2 );
		for( var i=0; i < nverts; i++ ) {
			texcoords[i] = -1.0;
			texcoords[nverts+i] = +1.0;
		}		
	}	
	
	/// Create GL buffers 
	self.createBuffers = function() {		
		// index buffer
		ibo = gl.createBuffer();
		
		// texcoords buffer
		tbo = gl.createBuffer();
		
		// vertex buffer
		vbo = gl.createBuffer();
		
		// normal buffer hack:
		// The normal buffer contains the vertices shifted by one so that the 
		// subsequent vertex of current vertex in the linestrip can be accessed
		// inside the vertex shader.
		nbo = gl.createBuffer();
	}
	
	/// Download buffers to the GPU
	self.updateBuffers = function( reallocate ) {
		if( reallocate ) {			
			// Changed buffers size requires reallocation
			var strategy = gl.DYNAMIC_DRAW; // was: gl.STATIC_DRAW;
			gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, ibo );
			gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW );
			gl.bindBuffer( gl.ARRAY_BUFFER, tbo );
			gl.bufferData( gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW );
			gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
			gl.bufferData( gl.ARRAY_BUFFER, verts, strategy );
			gl.bindBuffer( gl.ARRAY_BUFFER, nbo );
			gl.bufferData( gl.ARRAY_BUFFER, verts, strategy );			
		} else {
			// Same buffer size as before, only update dynamic buffers
			gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, verts );
			gl.bindBuffer( gl.ARRAY_BUFFER, nbo );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, verts );
		}
	}
	
	/// Update vertex data
	self.setData = function( buffer ) {
		
		// on a size change we have to reallocate our internal buffers
		var reallocate = !verts || verts.length != (nverts*3*2);
		
		// input number of vertices
		var nverts = buffer.length / 3;
		
		// (re-)allocate memory
		if( reallocate )
			self.allocateBuffers( nverts );

		// duplicate input buffer
		for( var i=0; i < nverts; i++ ) {			
			verts[3*nverts + 3*i+0] = verts[3*i+0] = buffer[3*i+0];
			verts[3*nverts + 3*i+1] = verts[3*i+1] = buffer[3*i+1];
			verts[3*nverts + 3*i+2] = verts[3*i+2] = buffer[3*i+2];
		}
		
		// download data to GPU
		self.updateBuffers( reallocate );
		
		self.deblog("Initialized data with "+nverts+" vertices"
		 +"indices.length="+indices.length+", texcoords.length="+texcoords.length,2);
		self.deblog("verts="+verts+", verts.length="+verts.length);		
	}	
	
	/// Setup illuminated lines renderer (must be called before setData())
	self.setup = function( gl_ ) {
		
		// Dependency on APP api
		getTexture    = APP.engine.loadTexture;
		compileShader = APP.engine.compileShader;
		gl = gl_;

		self.deblog("IlluminatedLines2.reset() with self="+self+", gl="+gl,2);
		
		// load textures
		shadingTex = getTexture( gl, 'shading.jpg' );
		spriteTex  = getTexture( gl, 'particle.png' );
	
		// compile shader
		self.deblog('Compiling shaders',2);
		var vshader = compileShader( gl, gl.VERTEX_SHADER  , vertexShaderSource   );
		var fshader = compileShader( gl, gl.FRAGMENT_SHADER, fragmentShaderSource );
		// To load shader from the DOM use the following:
		//		var vshader = getShader( gl, 'IlluminatedLines-vshader' );
		//		var fshader = getShader( gl, 'IlluminatedLines-fshader' );
		
		self.deblog('Linking program',2);		
		program = gl.createProgram();
		gl.attachShader ( program, vshader );
		gl.attachShader ( program, fshader );
		gl.linkProgram( program );
		
		// get attribute/uniform locations
		loc_vpos  = gl.getAttribLocation( program, 'vpos'  );
		loc_npos  = gl.getAttribLocation( program, 'npos'  );
		loc_tc    = gl.getAttribLocation( program, 'tc'    );
		loc_model = gl.getUniformLocation( program, 'model' );
		loc_proj  = gl.getUniformLocation( program, 'proj'  ); 
		loc_pointSize      = gl.getUniformLocation( program, 'pointSize' ); 
		loc_lineWidth      = gl.getUniformLocation( program, 'lineWidth' );
		loc_shadingSampler = gl.getUniformLocation( program, 'shadingSampler' );
		loc_spriteSampler  = gl.getUniformLocation( program, 'spriteSampler' );
		loc_ambient        = gl.getUniformLocation( program, 'ambient' );
		loc_specular       = gl.getUniformLocation( program, 'specular' );
		loc_doPointSprite  = gl.getUniformLocation( program, 'doPointSprite' );
		loc_alpha          = gl.getUniformLocation( program, 'alpha' );
		self.deblog('loc_vpos='+loc_vpos+', loc_npos='+loc_npos+', loc_tc='+loc_tc+', loc_model='+loc_model+', loc_proj='+loc_proj,3);
		
		// create buffer objects 
		self.createBuffers();
		
		// texcoords attribute		
		gl.bindBuffer( gl.ARRAY_BUFFER, tbo );
		gl.vertexAttribPointer( loc_tc, 1, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( loc_tc );
		
		// vertex attribute
		gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
		gl.vertexAttribPointer    ( loc_vpos, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( loc_vpos );

		// normal attribute
		gl.bindBuffer( gl.ARRAY_BUFFER, nbo );
		gl.vertexAttribPointer( loc_npos, 3, gl.FLOAT, false, 0,
		                        3*4 /* offset to start from 2nd element */ );
		gl.enableVertexAttribArray( loc_npos );
	
		/* 
		// invalid enum error:
		gl.enable( gl.VERTEX_PROGRAM_POINT_SIZE ); // 0x8642
		gl.enable( gl.POINT_SMOOTH ); // 0x0B10
			// For WebGL point size see:
			// http://asalga.wordpress.com/2010/05/06/smoothing-and-changing-point-sizes-in-webgl/
			// (--> seems no longer to be needed)
			
			// For point sprites see e.g. the following fire demo:
			// http://www.ibiblio.org/e-notes/webgl/models/fire.html
		*/
		gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
		
		// projection matrix
		mat_proj = mat4.create();
		mat4.perspective( 45, 4/3, 1, 200, mat_proj );
		
		// modelview matrix
		mat_model = mat4.create();
		mat4.identity ( mat_model );
		mat4.translate( mat_model, [0, 0, -5] );
	}	
	
	/// Render illuminated lines
	self.render = function() {	
		
		if( !verts )
			return;
		
		if( self.mode == self.modes.PLAIN_UNLIT )
			alpha = 0.0;
		else
			alpha = 1.0;
		
		// gl states
		switch( self.mode ) {
		default:
		case self.modes.FANCY:
			gl.enable( gl.BLEND );			
			gl.disable( gl.DEPTH_TEST );
			break;
		
		case self.modes.PLAIN_UNLIT:
		case self.modes.PLAIN:
			gl.disable( gl.BLEND );
			gl.enable( gl.DEPTH_TEST );
			break;
		}
		gl.disable( gl.CULL_FACE );
		
		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, shadingTex );
		gl.activeTexture( gl.TEXTURE1 );
		gl.bindTexture( gl.TEXTURE_2D, spriteTex );
	
		gl.useProgram( program );
		gl.uniform1f( loc_alpha, alpha );
		gl.uniform1f( loc_pointSize, pointSize );
		gl.uniform1f( loc_lineWidth, lineWidth );
		gl.uniform1i( loc_shadingSampler, 0 );
		gl.uniform1i( loc_spriteSampler,  1 );
		gl.uniform4fv( loc_ambient , self.colorAmbient  );
		gl.uniform4fv( loc_specular, self.colorSpecular );
		gl.uniformMatrix4fv( loc_proj , false, mat_proj );
		gl.uniformMatrix4fv( loc_model, false, mat_model );
		gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, ibo );

		if( self.mode==self.modes.FANCY ) {
			gl.uniform1f( loc_doPointSprite, true );
			gl.drawArrays( gl.POINTS, 0, verts.length/3-1 /* spare out last vertex */ );		
		}
		
		gl.uniform1f( loc_doPointSprite, false );
		gl.drawElements( gl.TRIANGLE_STRIP, verts.length/3-1, gl.UNSIGNED_SHORT, 0 );
	}
}
