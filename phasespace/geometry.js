/**
  Some 3D geometry primitives for APP WebGL framework. 

  \date October 2013
  \author Max Hermann (http://386dx25.de)
*/
window.APP = window.APP || {};

APP.geometry = {

	/// 2D Disc in xy plane
	createDisc : function( resolution ) {

		var res = resolution;
		var radius = 1.0;
		var x0 = 0.0;
		var y0 = 0.0;
		
		var nverts = res+1;
		var verts = new Float32Array( nverts*3 );
		
		verts[0] = x0;
		verts[1] = y0;
		verts[2] = 0.0;		
		for( var i=1; i < res+1; ++i ) {
			var theta = 2*Math.PI*(i-1)/(res-1);
			verts[ i*3+0 ] = x0 + radius*Math.cos(theta);
			verts[ i*3+1 ] = y0 + radius*Math.sin(theta);
			verts[ i*3+2 ] = 0.0;
		}
		
		return verts;
	},

	/// Create Lorentz attractor (based on code from Paul Bourke)
	createLorentzAttractor : function( n ) {
		
		var lorentz_verts = new Float32Array( n*3 );
		var a = 14.0, b = 28.0, c = 8.0 / 3.0,
			h=0.01, x0=0.1, y0=0, z0=0, x1,y1,z1;
		for( var i=0; i < n; i++ ) {
			x1 = x0 + h * a * (y0 - x0);
			y1 = y0 + h * (x0 * (b - z0) - y0);
			z1 = z0 + h * (x0 * y0 - c * z0);
			x0 = x1;
			y0 = y1;
			z0 = z1;
			lorentz_verts[3*i+0] = 0.07*x0;
			lorentz_verts[3*i+1] = 0.07*y0;
			lorentz_verts[3*i+2] = 0.07*z0 - 2.0;	
		}
		return lorentz_verts;
	},
	
	// Create a straight line between (0,-.5,0) and (0,.5,0), usefull for debugging
	createStraightLine : function( n ) {
		
		var line_verts = new Float32Array( n*3 );
		for( var i=0; i < n; i++ )	{
			var di = i * 1.0 / (n-1);
			line_verts[3*i+0] = 0;
			line_verts[3*i+1] = di - 0.5;
			line_verts[3*i+2] = 0;
		}
		return line_verts;
	}
};
