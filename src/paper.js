/*!
 * Paper.js v*#=*__options.version - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2016, Juerg Lehni & Jonathan Puckey
 * http://scratchdisk.com/ & http://jonathanpuckey.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 *
 * Date: *#=*__options.date
 *
 ***
 *
 * Straps.js - Class inheritance library with support for bean-style accessors
 *
 * Copyright (c) 2006 - 2016 Juerg Lehni
 * http://scratchdisk.com/
 *
 * Distributed under the MIT license.
 *
 ***
 *
 * Acorn.js
 * http://marijnhaverbeke.nl/acorn/
 *
 * Acorn is a tiny, fast JavaScript parser written in JavaScript,
 * created by Marijn Haverbeke and released under an MIT license.
 *
 */

// Allow the minification of the undefined variable by defining it as a local
// parameter inside the paper scope.
var paper = function(self, undefined) {
/*#*/ include('init.js');
/*#*/ include('../node_modules/straps/straps.js');

/*#*/ include('core/Base.js');
/*#*/ include('core/PaperScope.js');

/*#*/ include('util/Formatter.js');
/*#*/ include('util/Numerical.js');
/*#*/ include('util/UID.js');

/*#*/ include('basic/Point.js');
/*#*/ include('basic/Rectangle.js');
/*#*/ include('basic/Matrix.js');
/*#*/ include('basic/Line.js');

/*#*/ include('item/Item.js');
/*#*/ include('item/Group.js');

/*#*/ include('path/Segment.js');
/*#*/ include('path/SegmentPoint.js');
/*#*/ include('path/Curve.js');
/*#*/ include('path/CurveLocation.js');
/*#*/ include('path/PathItem.js');
/*#*/ include('path/Path.js');
/*#*/ include('path/CompoundPath.js');
/*#*/ include('path/PathItem.Boolean.js');
/*#*/ include('svg/SvgExport.js');

/*#*/ include('export.js');
return paper;
}.call(this, typeof self === 'object' ? self : null);
