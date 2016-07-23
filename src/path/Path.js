/*
 * Paper.js - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2016, Juerg Lehni & Jonathan Puckey
 * http://scratchdisk.com/ & http://jonathanpuckey.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

/**
 * @name Path
 *
 * @class The path item represents a path in a Paper.js project.
 *
 * @extends PathItem
 */
// DOCS: Explain that path matrix is always applied with each transformation.
var Path = PathItem.extend(/** @lends Path# */{
    _class: 'Path',
    

    initialize: function Path(arg) {
        this._closed = false;
        this._segments = [];
        // Increased on every change of segments, so CurveLocation knows when to
        // update its internally cached values.
        this._version = 0;
        // arg can either be an object literal containing properties to be set
        // on the path, a list of segments to be set, or the first of multiple
        // arguments describing separate segments.
        // If it is an array, it can also be a description of a point, so
        // check its first entry for object as well.
        // But first see if segments are directly passed at all. If not, try
        // _set(arg).
        var segments = Array.isArray(arg)
            ? typeof arg[0] === 'object'
                ? arg
                : arguments
            // See if it behaves like a segment or a point, but filter out
            // rectangles, as accepted by some Path.Constructor constructors.
            : arg && (arg.size === undefined && (arg.x !== undefined
                    || arg.point !== undefined))
                ? arguments
                : null;
        // Always call setSegments() to initialize a few related variables.
        if (segments && segments.length > 0) {
            // This sets _curves and _segmentSelection too!
            this.setSegments(segments);
        } else {
            this._curves = undefined; // For hidden class optimization
            this._segmentSelection = 0;
            if (!segments && typeof arg === 'string') {
                this.setPathData(arg);
                // Erase for _initialize() call below.
                arg = null;
            }
        }
        // Only pass on arg as props if it wasn't consumed for segments already.
        this._initialize(!segments && arg);
    },


    copyContent: function(source) {
        this.setSegments(source._segments);
        this._closed = source._closed;
    },


    getSegments: function() {
        return this._segments;
    },

    setSegments: function(segments) {
        var length = segments && segments.length;
        this._segments.length = 0;
        this._segmentSelection = 0;
        // Calculate new curves next time we call getCurves()
        this._curves = undefined;
        if (length) {
            // See if the last segment is a boolean describing the path's closed
            // state. This is part of the shorter segment array notation that
            // can also be nested to create compound-paths out of one array.
            var last = segments[length - 1];
            if (typeof last === 'boolean') {
                this.setClosed(last);
                length--;
            }
            this._add(Segment.readList(segments, 0, {}, length));
        }
 
    },


    getFirstSegment: function() {
        return this._segments[0];
    },

    getLastSegment: function() {
        return this._segments[this._segments.length - 1];
    },


    getCurves: function() {
        var curves = this._curves,
            segments = this._segments;
        if (!curves) {
            var length = this._countCurves();
            curves = this._curves = new Array(length);
            for (var i = 0; i < length; i++)
                curves[i] = new Curve(this, segments[i],
                    // Use first segment for segment2 of closing curve
                    segments[i + 1] || segments[0]);
        }
        return curves;
    },

    getFirstCurve: function() {
        return this.getCurves()[0];
    },


    getLastCurve: function() {
        var curves = this.getCurves();
        return curves[curves.length - 1];
    },


    isClosed: function() {
        return this._closed;
    },

    setClosed: function(closed) {
        // On-the-fly conversion to boolean:
        if (this._closed != (closed = !!closed)) {
            this._closed = closed;
            // Update _curves length
            if (this._curves) {
                var length = this._curves.length = this._countCurves();
                // If we were closing this path, we need to add a new curve now
                if (closed)
                    this._curves[length - 1] = new Curve(this,
                        this._segments[length - 1], this._segments[0]);
            }
        }
    }
}, /** @lends Path# */{
    // Enforce bean creation for getPathData() and getArea(), as they have
    // hidden parameters.
    beans: true,

    getPathData: function(_matrix, _precision) {
        // NOTE: #setPathData() is defined in PathItem.
        var segments = this._segments,
            length = segments.length,
            f = new Formatter(_precision),
            coords = new Array(6),
            first = true,
            curX, curY,
            prevX, prevY,
            inX, inY,
            outX, outY,
            parts = [];

        function addSegment(segment, skipLine) {
            segment._transformCoordinates(_matrix, coords);
            curX = coords[0];
            curY = coords[1];
            if (first) {
                parts.push('M' + f.pair(curX, curY));
                first = false;
            } else {
                inX = coords[2];
                inY = coords[3];
                if (inX === curX && inY === curY
                        && outX === prevX && outY === prevY) {
                    // l = relative lineto:
                    if (!skipLine) {
                        var dx = curX - prevX,
                            dy = curY - prevY;
                        parts.push(
                              dx === 0 ? 'v' + f.number(dy)
                            : dy === 0 ? 'h' + f.number(dx)
                            : 'l' + f.pair(dx, dy));
                    }
                } else {
                    // c = relative curveto:
                    parts.push('c' + f.pair(outX - prevX, outY - prevY)
                             + ' ' + f.pair( inX - prevX,  inY - prevY)
                             + ' ' + f.pair(curX - prevX, curY - prevY));
                }
            }
            prevX = curX;
            prevY = curY;
            outX = coords[4];
            outY = coords[5];
        }

        if (!length)
            return '';

        for (var i = 0; i < length; i++)
            addSegment(segments[i]);
        // Close path by drawing first segment again
        if (this._closed && length > 0) {
            addSegment(segments[0], true);
            parts.push('z');
        }
        return parts.join('');
    },

    // TODO: Consider adding getSubPath(a, b), returning a part of the current
    // path, with the added benefit that b can be < a, and closed looping is
    // taken into account.

    isEmpty: function() {
        return !this._segments.length;
    },

  

    _add: function(segs, index) {
        // Local short-cuts:
        var segments = this._segments,
            curves = this._curves,
            amount = segs.length,
            append = index == null,
            index = append ? segments.length : index;
        // Scan through segments to add first, convert if necessary and set
        // _path and _index references on them.
        for (var i = 0; i < amount; i++) {
            var segment = segs[i];
            // If the segments belong to another path already, clone them before
            // adding:
            if (segment._path)
                segment = segs[i] = segment.clone();
            segment._path = this;
            segment._index = index + i;
            // If parts of this segment are selected, adjust the internal
            // _segmentSelection now
            if (segment._selection)
                this._updateSelection(segment, 0, segment._selection);
        }
        if (append) {
            // Append them all at the end by using push
            segments.push.apply(segments, segs);
        } else {
            // Insert somewhere else
            segments.splice.apply(segments, [index, 0].concat(segs));
            // Adjust the indices of the segments above.
            for (var i = index + amount, l = segments.length; i < l; i++)
                segments[i]._index = i;
        }
        // Keep the curves list in sync all the time in case it was requested
        // already.
        if (curves) {
            var total = this._countCurves(),
                // If we're adding a new segment to the end of an open path,
                // we need to step one index down to get its curve.
                start = index > 0 && index + amount - 1 === total ? index - 1
                    : index,
                insert = start,
                end = Math.min(start + amount, total);
            if (segs._curves) {
                // Reuse removed curves.
                curves.splice.apply(curves, [start, 0].concat(segs._curves));
                insert += segs._curves.length;
            }
            // Insert new curves, but do not initialize their segments yet,
            // since #_adjustCurves() handles all that for us.
            for (var i = insert; i < end; i++)
                curves.splice(i, 0, new Curve(this, null, null));
            // Adjust segments for the curves before and after the removed ones
            this._adjustCurves(start, end);
        }
        return segs;
    },


    _adjustCurves: function(start, end) {
        var segments = this._segments,
            curves = this._curves,
            curve;
        for (var i = start; i < end; i++) {
            curve = curves[i];
            curve._path = this;
            curve._segment1 = segments[i];
            curve._segment2 = segments[i + 1] || segments[0];
        }
        // If it's the first segment, correct the last segment of closed
        // paths too:
        if (curve = curves[this._closed && !start ? segments.length - 1
                : start - 1]) {
            curve._segment2 = segments[start] || segments[0];
        }
        // Fix the segment after the modified range, if it exists
        if (curve = curves[end]) {
            curve._segment1 = segments[end];
        }
    },


    _countCurves: function() {
        var length = this._segments.length;
        // Reduce length by one if it's an open path:
        return !this._closed && length > 0 ? length - 1 : length;
    },

    // DOCS: find a way to document the variable segment parameters of Path#add

    add: function(segment1 /*, segment2, ... */) {
        return arguments.length > 1 && typeof segment1 !== 'number'
            // addSegments
            ? this._add(Segment.readList(arguments))
            // addSegment
            : this._add([ Segment.read(arguments) ])[0];
    },


    insert: function(index, segment1 /*, segment2, ... */) {
        return arguments.length > 2 && typeof segment1 !== 'number'
            // insertSegments
            ? this._add(Segment.readList(arguments, 1), index)
            // insertSegment
            : this._add([ Segment.read(arguments, 1) ], index)[0];
    },

    addSegment: function(/* segment */) {
        return this._add([ Segment.read(arguments) ])[0];
    },

    insertSegment: function(index /*, segment */) {
        return this._add([ Segment.read(arguments, 1) ], index)[0];
    },


    addSegments: function(segments) {
        return this._add(Segment.readList(segments));
    },


    insertSegments: function(index, segments) {
        return this._add(Segment.readList(segments), index);
    },


    removeSegment: function(index) {
        return this.removeSegments(index, index + 1)[0] || null;
    },


    removeSegments: function(start, end, _includeCurves) {
        start = start || 0;
        end = Base.pick(end, this._segments.length);
        var segments = this._segments,
            curves = this._curves,
            count = segments.length, // segment count before removal
            removed = segments.splice(start, end - start),
            amount = removed.length;
        if (!amount)
            return removed;
        // Update selection state accordingly
        for (var i = 0; i < amount; i++) {
            var segment = removed[i];
            if (segment._selection)
                this._updateSelection(segment, segment._selection, 0);
            // Clear the indices and path references of the removed segments
            segment._index = segment._path = null;
        }
        // Adjust the indices of the segments above.
        for (var i = start, l = segments.length; i < l; i++)
            segments[i]._index = i;
        // Keep curves in sync
        if (curves) {
            // If we're removing the last segment, remove the last curve (the
            // one to the left of the segment, not to the right, as normally).
            // Also take into account closed paths, which have one curve more
            // than segments.
            var index = start > 0 && end === count + (this._closed ? 1 : 0)
                    ? start - 1
                    : start,
                curves = curves.splice(index, amount);
            // Unlink the removed curves from the path.
            for (var i = curves.length - 1; i >= 0; i--)
                curves[i]._path = null;
            // Return the removed curves as well, if we're asked to include
            // them, but exclude the first curve, since that's shared with the
            // previous segment and does not connect the returned segments.
            if (_includeCurves)
                removed._curves = curves.slice(1);
            // Adjust segments for the curves before and after the removed ones
            this._adjustCurves(index, index);
        }

        return removed;
    },

    // DOCS Path#clear()
    clear: '#removeSegments',


   
    /**
     * The area that the path's geometry is covering. Self-intersecting paths
     * can contain sub-areas that cancel each other out.
     *
     * @bean
     * @type Number
     */
    getArea: function(_closed) {
        // If the call overrides the 'closed' state, do not cache the result.
        // This is used in tracePaths().
        var cached = _closed === undefined,
            area = this._area;
        if (!cached || area == null) {
            var segments = this._segments,
                count = segments.length,
                closed = cached ? this._closed : _closed,
                last = count - 1;
            area = 0;
            for (var i = 0, l = closed ? count : last; i < l; i++) {
                area += Curve.getArea(Curve.getValues(
                        segments[i], segments[i < last ? i + 1 : 0]));
            }
            if (cached)
                this._area = area;
        }
        return area;
    },

  
    join: function(path, tolerance) {
        var epsilon = tolerance || 0;
        if (path && path !== this) {
            var segments = path._segments,
                last1 = this.getLastSegment(),
                last2 = path.getLastSegment();
            if (!last2) // an empty path?
                return this;
            if (last1 && last1._point.isClose(last2._point, epsilon))
                path.reverse();
            var first2 = path.getFirstSegment();
            if (last1 && last1._point.isClose(first2._point, epsilon)) {
                last1.setHandleOut(first2._handleOut);
                this._add(segments.slice(1));
            } else {
                var first1 = this.getFirstSegment();
                if (first1 && first1._point.isClose(first2._point, epsilon))
                    path.reverse();
                last2 = path.getLastSegment();
                if (first1 && first1._point.isClose(last2._point, epsilon)) {
                    first1.setHandleIn(last2._handleIn);
                    // Prepend all segments from path except the last one.
                    this._add(segments.slice(0, segments.length - 1), 0);
                } else {
                    this._add(segments.slice());
                }
            }
            if (path._closed)
                this._add([segments[0]]);
            path.remove();
        }
        // Close the resulting path and merge first and last segment if they
        // touch, meaning the touched at path ends. Also do this if no path
        // argument was provided, in which cases the path is joined with itself
        // only if its ends touch.
        var first = this.getFirstSegment(),
            last = this.getLastSegment();
        if (first !== last && first._point.isClose(last._point, epsilon)) {
            first.setHandleIn(last._handleIn);
            last.remove();
            this.setClosed(true);
        }
        return this;
    },


    reduce: function(options) {
        var curves = this.getCurves(),
            // TODO: Find a better name, to not confuse with PathItem#simplify()
            simplify = options && options.simplify,
            // When not simplifying, only remove curves if their lengths are
            // absolutely 0.
            tolerance = simplify ? /*#=*/Numerical.GEOMETRIC_EPSILON : 0;
        for (var i = curves.length - 1; i >= 0; i--) {
            var curve = curves[i];
            // When simplifying, compare curves with isCollinear() will remove
            // any collinear neighboring curves regardless of their orientation.
            // This serves as a reliable way to remove linear overlaps but only
            // as long as the lines are truly overlapping.
            if (!curve.hasHandles() && (curve.getLength() < tolerance
                    || simplify && curve.isCollinear(curve.getNext())))
                curve.remove();
        }
        return this;
    },

    // NOTE: Documentation is in PathItem#reverse()
    reverse: function() {
        this._segments.reverse();
        // Reverse the handles:
        for (var i = 0, l = this._segments.length; i < l; i++) {
            var segment = this._segments[i];
            var handleIn = segment._handleIn;
            segment._handleIn = segment._handleOut;
            segment._handleOut = handleIn;
            segment._index = i;
        }
        // Clear curves since it all has changed.
        this._curves = null;
    },



    // TODO: intersects(item)
    // TODO: contains(item)
}, 

new function() { // PostScript-style drawing commands

    function getCurrentSegment(that) {
        var segments = that._segments;
        if (!segments.length)
            throw new Error('Use a moveTo() command first');
        return segments[segments.length - 1];
    }

    return {
        // NOTE: Documentation for these methods is found in PathItem, as they
        // are considered abstract methods of PathItem and need to be defined in
        // all implementing classes.
        moveTo: function(/* point */) {
            // moveTo should only be called at the beginning of paths. But it
            // can ce called again if there is nothing drawn yet, in which case
            // the first segment gets readjusted.
            var segments = this._segments;
            if (segments.length === 1)
                this.removeSegment(0);
            // Let's not be picky about calling moveTo() when not at the
            // beginning of a path, just bail out:
            if (!segments.length)
                this._add([ new Segment(Point.read(arguments)) ]);
        },

        moveBy: function(/* point */) {
            throw new Error('moveBy() is unsupported on Path items.');
        },

        lineTo: function(/* point */) {
            // Let's not be picky about calling moveTo() first:
            this._add([ new Segment(Point.read(arguments)) ]);
        },

        cubicCurveTo: function(/* handle1, handle2, to */) {
            var handle1 = Point.read(arguments),
                handle2 = Point.read(arguments),
                to = Point.read(arguments),
                // First modify the current segment:
                current = getCurrentSegment(this);
            // Convert to relative values:
            current.setHandleOut(handle1.subtract(current._point));
            // And add the new segment, with handleIn set to c2
            this._add([ new Segment(to, handle2.subtract(to)) ]);
        },

        quadraticCurveTo: function(/* handle, to */) {
            var handle = Point.read(arguments),
                to = Point.read(arguments),
                current = getCurrentSegment(this)._point;
            // This is exact:
            // If we have the three quad points: A E D,
            // and the cubic is A B C D,
            // B = E + 1/3 (A - E)
            // C = E + 1/3 (D - E)
            this.cubicCurveTo(
                handle.add(current.subtract(handle).multiply(1 / 3)),
                handle.add(to.subtract(handle).multiply(1 / 3)),
                to
            );
        },

        curveTo: function(/* through, to, time */) {
            var through = Point.read(arguments),
                to = Point.read(arguments),
                t = Base.pick(Base.read(arguments), 0.5),
                t1 = 1 - t,
                current = getCurrentSegment(this)._point,
                // handle = (through - (1 - t)^2 * current - t^2 * to) /
                // (2 * (1 - t) * t)
                handle = through.subtract(current.multiply(t1 * t1))
                    .subtract(to.multiply(t * t)).divide(2 * t * t1);
            if (handle.isNaN())
                throw new Error(
                    'Cannot put a curve through points with parameter = ' + t);
            this.quadraticCurveTo(handle, to);
        },

        arcTo: function(/* to, clockwise | through, to
                | to, radius, rotation, clockwise, large */) {
            // Get the start point:
            var current = getCurrentSegment(this),
                from = current._point,
                to = Point.read(arguments),
                through,
                // Peek at next value to see if it's clockwise, with true as the
                // default value.
                peek = Base.peek(arguments),
                clockwise = Base.pick(peek, true),
                center, extent, vector, matrix;
            // We're handling three different approaches to drawing arcs in one
            // large function:
            if (typeof clockwise === 'boolean') {
                // #1: arcTo(to, clockwise)
                var middle = from.add(to).divide(2),
                through = middle.add(middle.subtract(from).rotate(
                        clockwise ? -90 : 90));
            } else if (Base.remain(arguments) <= 2) {
                // #2: arcTo(through, to)
                through = to;
                to = Point.read(arguments);
            } else {
                // #3: arcTo(to, radius, rotation, clockwise, large)
                // Drawing arcs in SVG style:
                var radius = Size.read(arguments),
                    isZero = Numerical.isZero;
                // If rx = 0 or ry = 0 then this arc is treated as a
                // straight line joining the endpoints.
                // NOTE: radius.isZero() would require both values to be 0.
                if (isZero(radius.width) || isZero(radius.height))
                    return this.lineTo(to);
                // See for an explanation of the following calculations:
                // http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
                var rotation = Base.read(arguments),
                    clockwise = !!Base.read(arguments),
                    large = !!Base.read(arguments),
                    middle = from.add(to).divide(2),
                    pt = from.subtract(middle).rotate(-rotation),
                    x = pt.x,
                    y = pt.y,
                    abs = Math.abs,
                    rx = abs(radius.width),
                    ry = abs(radius.height),
                    rxSq = rx * rx,
                    rySq = ry * ry,
                    xSq = x * x,
                    ySq = y * y;
                // "...ensure radii are large enough"
                var factor = Math.sqrt(xSq / rxSq + ySq / rySq);
                if (factor > 1) {
                    rx *= factor;
                    ry *= factor;
                    rxSq = rx * rx;
                    rySq = ry * ry;
                }
                factor = (rxSq * rySq - rxSq * ySq - rySq * xSq) /
                        (rxSq * ySq + rySq * xSq);
                if (abs(factor) < /*#=*/Numerical.EPSILON)
                    factor = 0;
                if (factor < 0)
                    throw new Error(
                            'Cannot create an arc with the given arguments');
                center = new Point(rx * y / ry, -ry * x / rx)
                        // "...where the + sign is chosen if fA != fS,
                        // and the - sign is chosen if fA = fS."
                        .multiply((large === clockwise ? -1 : 1)
                            * Math.sqrt(factor))
                        .rotate(rotation).add(middle);
                // Now create a matrix that maps the unit circle to the ellipse,
                // for easier construction below.
                matrix = new Matrix().translate(center).rotate(rotation)
                        .scale(rx, ry);
                // Transform from and to to the unit circle coordinate space
                // and calculate start vector and extend from there.
                vector = matrix._inverseTransform(from);
                extent = vector.getDirectedAngle(matrix._inverseTransform(to));
                // "...if fS = 0 and extent is > 0, then subtract 360, whereas
                // if fS = 1 and extend is < 0, then add 360."
                if (!clockwise && extent > 0)
                    extent -= 360;
                else if (clockwise && extent < 0)
                    extent += 360;
            }
            if (through) {
                // Calculate center, vector and extend for non SVG versions:
                // Construct the two perpendicular middle lines to
                // (from, through) and (through, to), and intersect them to get
                // the center.
                var l1 = new Line(from.add(through).divide(2),
                            through.subtract(from).rotate(90), true),
                    l2 = new Line(through.add(to).divide(2),
                            to.subtract(through).rotate(90), true),
                    line = new Line(from, to),
                    throughSide = line.getSide(through);
                center = l1.intersect(l2, true);
                // If the two lines are collinear, there cannot be an arc as the
                // circle is infinitely big and has no center point. If side is
                // 0, the connecting arc line of this huge circle is a line
                // between the two points, so we can use #lineTo instead.
                // Otherwise we bail out:
                if (!center) {
                    if (!throughSide)
                        return this.lineTo(to);
                    throw new Error(
                            'Cannot create an arc with the given arguments');
                }
                vector = from.subtract(center);
                extent = vector.getDirectedAngle(to.subtract(center));
                var centerSide = line.getSide(center);
                if (centerSide === 0) {
                    // If the center is lying on the line, we might have gotten
                    // the wrong sign for extent above. Use the sign of the side
                    // of the through point.
                    extent = throughSide * Math.abs(extent);
                } else if (throughSide === centerSide) {
                    // If the center is on the same side of the line (from, to)
                    // as the through point, we're extending bellow 180 degrees
                    // and need to adapt extent.
                    extent += extent < 0 ? 360 : -360;
                }
            }
            var ext = Math.abs(extent),
                count = ext >= 360 ? 4 : Math.ceil(ext / 90),
                inc = extent / count,
                half = inc * Math.PI / 360,
                z = 4 / 3 * Math.sin(half) / (1 + Math.cos(half)),
                segments = [];
            for (var i = 0; i <= count; i++) {
                // Explicitly use to point for last segment, since depending
                // on values the calculation adds imprecision:
                var pt = to,
                    out = null;
                if (i < count) {
                    out = vector.rotate(90).multiply(z);
                    if (matrix) {
                        pt = matrix._transformPoint(vector);
                        out = matrix._transformPoint(vector.add(out))
                                .subtract(pt);
                    } else {
                        pt = center.add(vector);
                    }
                }
                if (!i) {
                    // Modify startSegment
                    current.setHandleOut(out);
                } else {
                    // Add new Segment
                    var _in = vector.rotate(-90).multiply(z);
                    if (matrix) {
                        _in = matrix._transformPoint(vector.add(_in))
                                .subtract(pt);
                    }
                    segments.push(new Segment(pt, _in, out));
                }
                vector = vector.rotate(inc);
            }
            // Add all segments at once at the end for higher performance
            this._add(segments);
        },

        lineBy: function(/* to */) {
            var to = Point.read(arguments),
                current = getCurrentSegment(this)._point;
            this.lineTo(current.add(to));
        },

        curveBy: function(/* through, to, parameter */) {
            var through = Point.read(arguments),
                to = Point.read(arguments),
                parameter = Base.read(arguments),
                current = getCurrentSegment(this)._point;
            this.curveTo(current.add(through), current.add(to), parameter);
        },

        cubicCurveBy: function(/* handle1, handle2, to */) {
            var handle1 = Point.read(arguments),
                handle2 = Point.read(arguments),
                to = Point.read(arguments),
                current = getCurrentSegment(this)._point;
            this.cubicCurveTo(current.add(handle1), current.add(handle2),
                    current.add(to));
        },

        quadraticCurveBy: function(/* handle, to */) {
            var handle = Point.read(arguments),
                to = Point.read(arguments),
                current = getCurrentSegment(this)._point;
            this.quadraticCurveTo(current.add(handle), current.add(to));
        },

        // TODO: Implement version for: (to, radius, rotation, clockwise, large)
        arcBy: function(/* to, clockwise | through, to */) {
            var current = getCurrentSegment(this)._point,
                point = current.add(Point.read(arguments)),
                // Peek at next value to see if it's clockwise, with true as
                // default value.
                clockwise = Base.pick(Base.peek(arguments), true);
            if (typeof clockwise === 'boolean') {
                this.arcTo(point, clockwise);
            } else {
                this.arcTo(point, current.add(Point.read(arguments)));
            }
        },

        closePath: function(tolerance) {
            this.setClosed(true);
            this.join(this, tolerance);
        }
    };
});
