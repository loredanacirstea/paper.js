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
    _serializeFields: {
        segments: [],
        closed: false
    },

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

    _equals: function(item) {
        return this._closed === item._closed
                && Base.equals(this._segments, item._segments);
    },

    copyContent: function(source) {
        this.setSegments(source._segments);
        this._closed = source._closed;
    },

    /**
     * The segments contained within the path.
     *
     * @bean
     * @type Segment[]
     */
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

    /**
     * The first Segment contained within the path.
     *
     * @bean
     * @type Segment
     */
    getFirstSegment: function() {
        return this._segments[0];
    },

    /**
     * The last Segment contained within the path.
     *
     * @bean
     * @type Segment
     */
    getLastSegment: function() {
        return this._segments[this._segments.length - 1];
    },

    /**
     * The curves contained within the path.
     *
     * @bean
     * @type Curve[]
     */
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

    /**
     * The first Curve contained within the path.
     *
     * @bean
     * @type Curve
     */
    getFirstCurve: function() {
        return this.getCurves()[0];
    },

    /**
     * The last Curve contained within the path.
     *
     * @bean
     * @type Curve
     */
    getLastCurve: function() {
        var curves = this.getCurves();
        return curves[curves.length - 1];
    },

    /**
     * Specifies whether the path is closed. If it is closed, Paper.js connects
     * the first and last segments.
     *
     * @bean
     * @type Boolean
     *
     * @example {@paperscript}
     * var myPath = new Path();
     * myPath.strokeColor = 'black';
     * myPath.add(new Point(50, 75));
     * myPath.add(new Point(100, 25));
     * myPath.add(new Point(150, 75));
     *
     * // Close the path:
     * myPath.closed = true;
     */
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

    _transformContent: function(matrix) {
        var segments = this._segments,
            coords = new Array(6);
        for (var i = 0, l = segments.length; i < l; i++)
            segments[i]._transformCoordinates(matrix, coords, true);
        return true;
    },

    /**
     * Private method that adds segments to the segment list. It assumes that
     * the passed object is an array of segments already and does not perform
     * any checks. If a curves list was requested, it will be kept in sync with
     * the segments list automatically.
     */
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

    /**
     * Adjusts segments of curves before and after inserted / removed segments.
     */
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

    /**
     * Returns the amount of curves this path item is supposed to have, based
     * on its amount of #segments and #closed state.
     */
    _countCurves: function() {
        var length = this._segments.length;
        // Reduce length by one if it's an open path:
        return !this._closed && length > 0 ? length - 1 : length;
    },

    // DOCS: find a way to document the variable segment parameters of Path#add
    /**
     * Adds one or more segments to the end of the {@link #segments} array of
     * this path.
     *
     * @param {Segment|Point} segment the segment or point to be added.
     * @return {Segment} the added segment. This is not necessarily the same
     * object, e.g. if the segment to be added already belongs to another path
     *
     * @example {@paperscript}
     * // Adding segments to a path using point objects:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     *
     * // Add a segment at {x: 30, y: 75}
     * path.add(new Point(30, 75));
     *
     * // Add two segments in one go at {x: 100, y: 20}
     * // and {x: 170, y: 75}:
     * path.add(new Point(100, 20), new Point(170, 75));
     *
     * @example {@paperscript}
     * // Adding segments to a path using arrays containing number pairs:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     *
     * // Add a segment at {x: 30, y: 75}
     * path.add([30, 75]);
     *
     * // Add two segments in one go at {x: 100, y: 20}
     * // and {x: 170, y: 75}:
     * path.add([100, 20], [170, 75]);
     *
     * @example {@paperscript}
     * // Adding segments to a path using objects:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     *
     * // Add a segment at {x: 30, y: 75}
     * path.add({x: 30, y: 75});
     *
     * // Add two segments in one go at {x: 100, y: 20}
     * // and {x: 170, y: 75}:
     * path.add({x: 100, y: 20}, {x: 170, y: 75});
     *
     * @example {@paperscript}
     * // Adding a segment with handles to a path:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     *
     * path.add(new Point(30, 75));
     *
     * // Add a segment with handles:
     * var point = new Point(100, 20);
     * var handleIn = new Point(-50, 0);
     * var handleOut = new Point(50, 0);
     * var added = path.add(new Segment(point, handleIn, handleOut));
     *
     * // Select the added segment, so we can see its handles:
     * added.selected = true;
     *
     * path.add(new Point(170, 75));
     */
    add: function(segment1 /*, segment2, ... */) {
        return arguments.length > 1 && typeof segment1 !== 'number'
            // addSegments
            ? this._add(Segment.readList(arguments))
            // addSegment
            : this._add([ Segment.read(arguments) ])[0];
    },

    /**
     * Inserts one or more segments at a given index in the list of this path's
     * segments.
     *
     * @param {Number} index the index at which to insert the segment
     * @param {Segment|Point} segment the segment or point to be inserted.
     * @return {Segment} the added segment. This is not necessarily the same
     * object, e.g. if the segment to be added already belongs to another path
     *
     * @example {@paperscript}
     * // Inserting a segment:
     * var myPath = new Path();
     * myPath.strokeColor = 'black';
     * myPath.add(new Point(50, 75));
     * myPath.add(new Point(150, 75));
     *
     * // Insert a new segment into myPath at index 1:
     * myPath.insert(1, new Point(100, 25));
     *
     * // Select the segment which we just inserted:
     * myPath.segments[1].selected = true;
     *
     * @example {@paperscript}
     * // Inserting multiple segments:
     * var myPath = new Path();
     * myPath.strokeColor = 'black';
     * myPath.add(new Point(50, 75));
     * myPath.add(new Point(150, 75));
     *
     * // Insert two segments into myPath at index 1:
     * myPath.insert(1, [80, 25], [120, 25]);
     *
     * // Select the segments which we just inserted:
     * myPath.segments[1].selected = true;
     * myPath.segments[2].selected = true;
     */
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

    /**
     * Adds an array of segments (or types that can be converted to segments)
     * to the end of the {@link #segments} array.
     *
     * @param {Segment[]} segments
     * @return {Segment[]} an array of the added segments. These segments are
     * not necessarily the same objects, e.g. if the segment to be added already
     * belongs to another path
     *
     * @example {@paperscript}
     * // Adding an array of Point objects:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     * var points = [new Point(30, 50), new Point(170, 50)];
     * path.addSegments(points);
     *
     * @example {@paperscript}
     * // Adding an array of [x, y] arrays:
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     * var array = [[30, 75], [100, 20], [170, 75]];
     * path.addSegments(array);
     *
     * @example {@paperscript}
     * // Adding segments from one path to another:
     *
     * var path = new Path({
     *     strokeColor: 'black'
     * });
     * path.addSegments([[30, 75], [100, 20], [170, 75]]);
     *
     * var path2 = new Path();
     * path2.strokeColor = 'red';
     *
     * // Add the second and third segments of path to path2:
     * path2.add(path.segments[1], path.segments[2]);
     *
     * // Move path2 30pt to the right:
     * path2.position.x += 30;
     */
    addSegments: function(segments) {
        return this._add(Segment.readList(segments));
    },

    /**
     * Inserts an array of segments at a given index in the path's
     * {@link #segments} array.
     *
     * @param {Number} index the index at which to insert the segments
     * @param {Segment[]} segments the segments to be inserted
     * @return {Segment[]} an array of the added segments. These segments are
     * not necessarily the same objects, e.g. if the segment to be added already
     * belongs to another path
     */
    insertSegments: function(index, segments) {
        return this._add(Segment.readList(segments), index);
    },

    /**
     * Removes the segment at the specified index of the path's
     * {@link #segments} array.
     *
     * @param {Number} index the index of the segment to be removed
     * @return {Segment} the removed segment
     *
     * @example {@paperscript}
     * // Removing a segment from a path:
     *
     * // Create a circle shaped path at { x: 80, y: 50 }
     * // with a radius of 35:
     * var path = new Path.Circle({
     *     center: new Point(80, 50),
     *     radius: 35,
     *     strokeColor: 'black'
     * });
     *
     * // Remove its second segment:
     * path.removeSegment(1);
     *
     * // Select the path, so we can see its segments:
     * path.selected = true;
     */
    removeSegment: function(index) {
        return this.removeSegments(index, index + 1)[0] || null;
    },

    /**
     * Removes all segments from the path's {@link #segments} array.
     *
     * @name Path#removeSegments
     * @alias Path#clear
     * @function
     * @return {Segment[]} an array containing the removed segments
     */
    /**
     * Removes the segments from the specified `from` index to the `to` index
     * from the path's {@link #segments} array.
     *
     * @param {Number} from the beginning index, inclusive
     * @param {Number} [to=segments.length] the ending index, exclusive
     * @return {Segment[]} an array containing the removed segments
     *
     * @example {@paperscript}
     * // Removing segments from a path:
     *
     * // Create a circle shaped path at { x: 80, y: 50 }
     * // with a radius of 35:
     * var path = new Path.Circle({
     *     center: new Point(80, 50),
     *     radius: 35,
     *     strokeColor: 'black'
     * });
     *
     * // Remove the segments from index 1 till index 2:
     * path.removeSegments(1, 2);
     *
     * // Select the path, so we can see its segments:
     * path.selected = true;
     */
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
     * The approximate length of the path.
     *
     * @bean
     * @type Number
     */
    getLength: function() {
        if (this._length == null) {
            var curves = this.getCurves(),
                length = 0;
            for (var i = 0, l = curves.length; i < l; i++)
                length += curves[i].getLength();
            this._length = length;
        }
        return this._length;
    },

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

  
    /**
     * Splits the path at the given offset or location. After splitting, the
     * path will be open. If the path was open already, splitting will result in
     * two paths.
     *
     * @param {Number|CurveLocation} location the offset or location at which to
     *     split the path
     * @return {Path} the newly created path after splitting, if any
     *
     * @example {@paperscript}
     * var path = new Path.Circle({
     *     center: view.center,
     *     radius: 40,
     *     strokeColor: 'black'
     * });
     *
     * var pointOnCircle = view.center + {
     *     length: 40,
     *     angle: 30
     * };
     *
     * var location = path.getNearestLocation(pointOnCircle);
     *
     * path.splitAt(location);
     * path.lastSegment.selected = true;
     *
     * @example {@paperscript} // Splitting an open path
     * // Draw a V shaped path:
     * var path = new Path([20, 20], [50, 80], [80, 20]);
     * path.strokeColor = 'black';
     *
     * // Split the path half-way:
     * var path2 = path.splitAt(path2.length / 2);
     *
     * // Give the resulting path a red stroke-color
     * // and move it 20px to the right:
     * path2.strokeColor = 'red';
     * path2.position.x += 20;
     *
     * @example {@paperscript} // Splitting a closed path
     * var path = new Path.Rectangle({
     *     from: [20, 20],
     *     to: [80, 80],
     *     strokeColor: 'black'
     * });
     *
     * // Split the path half-way:
     * path.splitAt(path.length / 2);
     *
     * // Move the first segment, to show where the path
     * // was split:
     * path.firstSegment.point.x += 20;
     *
     * // Select the first segment:
     * path.firstSegment.selected = true;
     */
    splitAt: function(location) {
        var loc = typeof location === 'number'
                ? this.getLocationAt(location) : location,
            index = loc && loc.index,
            time = loc && loc.time,
            tMin = /*#=*/Numerical.CURVETIME_EPSILON,
            tMax = 1 - tMin;
        if (time >= tMax) {
            // time == 1 is the same location as time == 0 and index++
            index++;
            time = 0;
        }
        var curves = this.getCurves();
        if (index >= 0 && index < curves.length) {
            // Only divide curves if we're not on an existing segment already.
            if (time >= tMin) {
                // Divide the curve with the index at the given curve-time.
                // Increase because dividing adds more segments to the path.
                curves[index++].divideAtTime(time);
            }
            // Create the new path with the segments to the right of given
            // curve-time, which are removed from the current path. Pass true
            // for includeCurves, since we want to preserve and move them to
            // the new path through _add(), allowing us to have CurveLocation
            // keep the connection to the new path through moved curves.
            var segs = this.removeSegments(index, this._segments.length, true),
                path;
            if (this._closed) {
                // If the path is closed, open it and move the segments round,
                // otherwise create two paths.
                this.setClosed(false);
                // Just have path point to this. The moving around of segments
                // will happen below.
                path = this;
            } else {
                path = new Path(Item.NO_INSERT);
                path.insertAbove(this);
                path.copyAttributes(this);
            }
            path._add(segs, 0);
            // Add dividing segment again. In case of a closed path, that's the
            // beginning segment again at the end, since we opened it.
            this.addSegment(segs[0]);
            return path;
        }
        return null;
    },

    /**
     * @deprecated use use {@link #splitAt(offset)} instead.
     */
    split: function(index, time) {
        var curve,
            location = time === undefined ? index
                : (curve = this.getCurves()[index])
                    && curve.getLocationAtTime(time);
        return location != null ? this.splitAt(location) : null;
    },

    /**
     * Joins the path with the other specified path, which will be removed in
     * the process. They can be joined if the first or last segments of either
     * path lie in the same location. Locations are optionally compare with a
     * provide `tolerance` value.
     *
     * If `null` or `this` is passed as the other path, the path will be joined
     * with itself if the first and last segment are in the same location.
     *
     * @param {Path} path the path to join this path with; `null` or `this` to
     *     join the path with itself
     * @param {Number} [tolerance=0] the tolerance with which to decide if two
     *     segments are to be considered the same location when joining
     *
     * @example {@paperscript}
     * // Joining two paths:
     * var path = new Path({
     *     segments: [[30, 25], [30, 75]],
     *     strokeColor: 'black'
     * });
     *
     * var path2 = new Path({
     *     segments: [[200, 25], [200, 75]],
     *     strokeColor: 'black'
     * });
     *
     * // Join the paths:
     * path.join(path2);
     *
     * @example {@paperscript}
     * // Joining two paths that share a point at the start or end of their
     * // segments array:
     * var path = new Path({
     *     segments: [[30, 25], [30, 75]],
     *     strokeColor: 'black'
     * });
     *
     * var path2 = new Path({
     *     segments: [[30, 25], [80, 25]],
     *     strokeColor: 'black'
     * });
     *
     * // Join the paths:
     * path.join(path2);
     *
     * // After joining, path with have 3 segments, since it
     * // shared its first segment point with the first
     * // segment point of path2.
     *
     * // Select the path to show that they have joined:
     * path.selected = true;
     *
     * @example {@paperscript}
     * // Joining two paths that connect at two points:
     * var path = new Path({
     *     segments: [[30, 25], [80, 25], [80, 75]],
     *     strokeColor: 'black'
     * });
     *
     * var path2 = new Path({
     *     segments: [[30, 25], [30, 75], [80, 75]],
     *     strokeColor: 'black'
     * });
     *
     * // Join the paths:
     * path.join(path2);
     *
     * // Because the paths were joined at two points, the path is closed
     * // and has 4 segments.
     *
     * // Select the path to show that they have joined:
     * path.selected = true;
     */
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

    /**
     * Reduces the path by removing curves that have a length of 0,
     * and unnecessary segments between two collinear flat curves.
     */
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

    // NOTE: Documentation is in PathItem#flatten()
    flatten: function(flatness) {
        // Use PathIterator to subdivide the curves into parts that are flat
        // enough, as specified by `flatness` / Curve.isFlatEnough():
        var iterator = new PathIterator(this, flatness || 0.25, 256, true),
            parts = iterator.parts,
            length = parts.length,
            segments = [];
        for (var i = 0; i < length; i++) {
            segments.push(new Segment(parts[i].curve.slice(0, 2)));
        }
        if (!this._closed && length > 0) {
            // We need to explicitly add the end point of the last curve on open paths.
            segments.push(new Segment(parts[length - 1].curve.slice(6)));
        }
        this.setSegments(segments);
    },

    // NOTE: Documentation is in PathItem#simplify()
    simplify: function(tolerance) {
        var segments = new PathFitter(this).fit(tolerance || 2.5);
        if (segments)
            this.setSegments(segments);
        return !!segments;
    },

    // NOTE: Documentation is in PathItem#smooth()
    smooth: function(options) {
        var that = this,
            opts = options || {},
            type = opts.type || 'asymmetric',
            segments = this._segments,
            length = segments.length,
            closed = this._closed;

        // Helper method to pick the right from / to indices.
        // Supports numbers and segment objects.
        // For numbers, the `to` index is exclusive, while for segments and
        // curves, it is inclusive, handled by the `offset` parameter.
        function getIndex(value, _default) {
            // Support both Segment and Curve through #index getter.
            var index = value && value.index;
            if (index != null) {
                // Make sure the segment / curve is not from a wrong path.
                var path = value.path;
                if (path && path !== that)
                    throw new Error(value._class + ' ' + index + ' of ' + path
                            + ' is not part of ' + that);
                // Add offset of 1 to curves to reach their end segment.
                if (_default && value instanceof Curve)
                    index++;
            } else {
                index = typeof value === 'number' ? value : _default;
            }
            // Handle negative values based on whether a path is open or not:
            // Ranges on closed paths are allowed to wrapped around the
            // beginning/end (e.g. start near the end, end near the beginning),
            // while ranges on open paths stay within the path's open range.
            return Math.min(index < 0 && closed
                    ? index % length
                    : index < 0 ? index + length : index, length - 1);
        }

        var loop = closed && opts.from === undefined && opts.to === undefined,
            from = getIndex(opts.from, 0),
            to = getIndex(opts.to, length - 1);

        if (from > to) {
            if (closed) {
                from -= length;
            } else {
                var tmp = from;
                from = to;
                to = tmp;
            }
        }
        if (/^(?:asymmetric|continuous)$/.test(type)) {
            // Continuous smoothing approach based on work by Lubos Brieda,
            // Particle In Cell Consulting LLC, but further simplified by
            // addressing handle symmetry across segments, and the possibility
            // to process x and y coordinates simultaneously. Also added
            // handling of closed paths.
            // https://www.particleincell.com/2012/bezier-splines/
            //
            // We use different parameters for the two supported smooth methods
            // that use this algorithm: continuous and asymmetric. asymmetric
            // was the only approach available in v0.9.25 & below.
            var asymmetric = type === 'asymmetric',
                min = Math.min,
                amount = to - from + 1,
                n = amount - 1,
                // Overlap by up to 4 points on closed paths since a current
                // segment is affected by its 4 neighbors on both sides (?).
                padding = loop ? min(amount, 4) : 1,
                paddingLeft = padding,
                paddingRight = padding,
                knots = [];
            if (!closed) {
                // If the path is open and a range is defined, try using a
                // padding of 1 on either side.
                paddingLeft = min(1, from);
                paddingRight = min(1, length - to - 1);
            }
            // Set up the knots array now, taking the paddings into account.
            n += paddingLeft + paddingRight;
            if (n <= 1)
                return;
            for (var i = 0, j = from - paddingLeft; i <= n; i++, j++) {
                knots[i] = segments[(j < 0 ? j + length : j) % length]._point;
            }

            // In the algorithm we treat these 3 cases:
            // - left most segment (L)
            // - internal segments (I)
            // - right most segment (R)
            //
            // In both the continuous and asymmetric method, c takes these
            // values and can hence be removed from the loop starting in n - 2:
            // c = 1 (L), 1 (I), 0 (R)
            //
            // continuous:
            // a = 0 (L), 1 (I), 2 (R)
            // b = 2 (L), 4 (I), 7 (R)
            // u = 1 (L), 4 (I), 8 (R)
            // v = 2 (L), 2 (I), 1 (R)
            //
            // asymmetric:
            // a = 0 (L), 1 (I), 1 (R)
            // b = 2 (L), 4 (I), 2 (R)
            // u = 1 (L), 4 (I), 3 (R)
            // v = 2 (L), 2 (I), 0 (R)

            // (L): u = 1, v = 2
            var x = knots[0]._x + 2 * knots[1]._x,
                y = knots[0]._y + 2 * knots[1]._y,
                f = 2,
                n_1 = n - 1,
                rx = [x],
                ry = [y],
                rf = [f],
                px = [],
                py = [];
            // Solve with the Thomas algorithm
            for (var i = 1; i < n; i++) {
                var internal = i < n_1,
                    //  internal--(I)  asymmetric--(R) (R)--continuous
                    a = internal ? 1 : asymmetric ? 1 : 2,
                    b = internal ? 4 : asymmetric ? 2 : 7,
                    u = internal ? 4 : asymmetric ? 3 : 8,
                    v = internal ? 2 : asymmetric ? 0 : 1,
                    m = a / f;
                f = rf[i] = b - m;
                x = rx[i] = u * knots[i]._x + v * knots[i + 1]._x - m * x;
                y = ry[i] = u * knots[i]._y + v * knots[i + 1]._y - m * y;
            }

            px[n_1] = rx[n_1] / rf[n_1];
            py[n_1] = ry[n_1] / rf[n_1];
            for (var i = n - 2; i >= 0; i--) {
                px[i] = (rx[i] - px[i + 1]) / rf[i];
                py[i] = (ry[i] - py[i + 1]) / rf[i];
            }
            px[n] = (3 * knots[n]._x - px[n_1]) / 2;
            py[n] = (3 * knots[n]._y - py[n_1]) / 2;

            // Now update the segments
            for (var i = paddingLeft, max = n - paddingRight, j = from;
                    i <= max; i++, j++) {
                var segment = segments[j < 0 ? j + length : j],
                    pt = segment._point,
                    hx = px[i] - pt._x,
                    hy = py[i] - pt._y;
                if (loop || i < max)
                    segment.setHandleOut(hx, hy);
                if (loop || i > paddingLeft)
                    segment.setHandleIn(-hx, -hy);
            }
        } else {
            // All other smoothing methods are handled directly on the segments:
            for (var i = from; i <= to; i++) {
                segments[i < 0 ? i + length : i].smooth(opts,
                        !loop && i === from, !loop && i === to);
            }
        }
    },

    // TODO: reduceSegments([flatness])


    toPath: '#clone',

    // NOTE: Documentation is in PathItem#compare()
    compare: function compare(path) {
        // If a compound-path is involved, redirect to PathItem#compare()
        if (!path || path instanceof CompoundPath)
            return compare.base.call(this, path);
        var curves1 = this.getCurves(),
            curves2 = path.getCurves(),
            length1 = curves1.length,
            length2 = curves2.length;
        if (!length1 || !length2) {
            // If one path defines curves and the other doesn't, we can't have
            // matching geometries.
            return length1 ^ length2;
        }
        var v1 = curves1[0].getValues(),
            values2 = [],
            pos1 = 0, pos2,
            end1 = 0, end2;
        // First, loop through curves2, looking for the start of the overlapping
        // sequence with curves1[0]. Also cache curve values for later reuse.
        for (var i = 0; i < length2; i++) {
            var v2 = curves2[i].getValues();
            values2.push(v2);
            var overlaps = Curve.getOverlaps(v1, v2);
            if (overlaps) {
                // If the overlap doesn't start at the beginning of v2, then it
                // can only be a partial overlap with curves2[0], and the start
                // will be at curves2[length2 - 1]:
                pos2 = !i && overlaps[0][0] > 0 ? length2 - 1 : i;
                // Set end2 to the start of the first overlap on curves2, so
                // connection checks further down can work.
                end2 = overlaps[0][1];
                break;
            }
        }
        // Now loop through both curve arrays, find their overlaps, verify that
        // they keep joining, and see if we end back at the start on both paths.
        var abs = Math.abs,
            epsilon = /*#=*/Numerical.CURVETIME_EPSILON,
            v2 = values2[pos2],
            start2;
        while (v1 && v2) {
            var overlaps = Curve.getOverlaps(v1, v2);
            if (overlaps) {
                // Check that the overlaps are joining on curves1.
                var t1 = overlaps[0][0];
                if (abs(t1 - end1) < epsilon) {
                    end1 = overlaps[1][0];
                    if (end1 === 1) {
                        // Skip to the next curve if we're at the end of the
                        // current, and set v1 to null if at the end of curves1.
                        v1 = ++pos1 < length1 ? curves1[pos1].getValues() : null;
                        end1 = 0;
                    }
                    // Check that the overlaps are joining on curves2.
                    var t2 = overlaps[0][1];
                    if (abs(t2 - end2) < epsilon) {
                        if (!start2)
                            start2 = [pos2, t2];
                        end2 = overlaps[1][1];
                        if (end2 === 1) {
                            // Wrap pos2 around the end on values2:
                            if (++pos2 >= length2)
                                pos2 = 0;
                            // Reuse cached values from initial search.
                            v2 = values2[pos2] || curves2[pos2].getValues();
                            end2 = 0;
                        }
                        if (!v1) {
                            // We're done with curves1. If we're not back at the
                            // start on curve2, the two paths are not identical.
                            return start2[0] === pos2 && start2[1] === end2;
                        }
                        // All good, continue to avoid the break; further down.
                        continue;
                    }
                }
            }
            // No overlap match found, break out early.
            break;
        }
        return false;
    },

    // TODO: intersects(item)
    // TODO: contains(item)
}, Base.each(Curve._evaluateMethods,
    function(name) {
        // NOTE: (For easier searching): This loop produces:
        // getPointAt, getTangentAt, getNormalAt, getWeightedTangentAt,
        // getWeightedNormalAt, getCurvatureAt
        this[name + 'At'] = function(offset) {
            var loc = this.getLocationAt(offset);
            return loc && loc[name]();
        };
    },
/** @lends Path# */{
    // Explicitly deactivate the creation of beans, as we have functions here
    // that look like bean getters but actually read arguments.
    // See #getLocationOf(), #getOffsetOf(), #getLocationAt()
    beans: false,



}),

new function() { // PostScript-style drawing commands
    /**
     * Helper method that returns the current segment and checks if a moveTo()
     * command is required first.
     */
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
}, { // A dedicated scope for the tricky bounds calculations
    // We define all the different getBounds functions as static methods on Path
    // and have #_getBounds directly access these. All static bounds functions
    // below have the same first four parameters: segments, closed, path,
    // matrix, so they can be called from #_getBounds() and also be used in
    // Curve. But not all of them use all these parameters, and some define
    // additional ones after.

    _getBounds: function(matrix, options) {
        var method = options.handle
                ? 'getHandleBounds'
                : options.stroke
                ? 'getStrokeBounds'
                : 'getBounds';
        return Path[method](this._segments, this._closed, this, matrix, options);
    },

// Mess with indentation in order to get more line-space below:
statics: {
    /**
     * Returns the bounding rectangle of the item excluding stroke width.
     *
     * @private
     */
    getBounds: function(segments, closed, path, matrix, options, strokePadding) {
        var first = segments[0];
        // If there are no segments, return "empty" rectangle, just like groups,
        // since #bounds is assumed to never return null.
        if (!first)
            return new Rectangle();
        var coords = new Array(6),
            // Make coordinates for first segment available in prevCoords.
            prevCoords = first._transformCoordinates(matrix, new Array(6)),
            min = prevCoords.slice(0, 2), // Start with values of first point
            max = min.slice(), // clone
            roots = new Array(2);

        function processSegment(segment) {
            segment._transformCoordinates(matrix, coords);
            for (var i = 0; i < 2; i++) {
                Curve._addBounds(
                    prevCoords[i], // prev.point
                    prevCoords[i + 4], // prev.handleOut
                    coords[i + 2], // segment.handleIn
                    coords[i], // segment.point,
                    i, strokePadding ? strokePadding[i] : 0, min, max, roots);
            }
            // Swap coordinate buffers.
            var tmp = prevCoords;
            prevCoords = coords;
            coords = tmp;
        }

        for (var i = 1, l = segments.length; i < l; i++)
            processSegment(segments[i]);
        if (closed)
            processSegment(first);
        return new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
    }
}});
