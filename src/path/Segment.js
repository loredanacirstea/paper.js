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
 * @name Segment
 *
 * @class The Segment object represents the points of a path through which its
 * {@link Curve} objects pass. The segments of a path can be accessed through
 * its {@link Path#segments} array.
 *
 * Each segment consists of an anchor point ({@link Segment#point}) and
 * optionaly an incoming and an outgoing handle ({@link Segment#handleIn} and
 * {@link Segment#handleOut}), describing the tangents of the two {@link Curve}
 * objects that are connected by this segment.
 */
var Segment = Base.extend(/** @lends Segment# */{
    _class: 'Segment',
    beans: true,
    // The selection state, a combination of SegmentSelection
    _selection: 0,

    /**
     * Creates a new Segment object.
     *
     * @name Segment#initialize
     * @param {Point} [point={x: 0, y: 0}] the anchor point of the segment
     * @param {Point} [handleIn={x: 0, y: 0}] the handle point relative to the
     *     anchor point of the segment that describes the in tangent of the
     *     segment
     * @param {Point} [handleOut={x: 0, y: 0}] the handle point relative to the
     *     anchor point of the segment that describes the out tangent of the
     *     segment
     *
     * @example {@paperscript}
     * var handleIn = new Point(-80, -100);
     * var handleOut = new Point(80, 100);
     *
     * var firstPoint = new Point(100, 50);
     * var firstSegment = new Segment(firstPoint, null, handleOut);
     *
     * var secondPoint = new Point(300, 50);
     * var secondSegment = new Segment(secondPoint, handleIn, null);
     *
     * var path = new Path(firstSegment, secondSegment);
     * path.strokeColor = 'black';
     */
    /**
     * Creates a new Segment object.
     *
     * @name Segment#initialize
     * @param {Object} object an object containing properties to be set on the
     *     segment
     *
     * @example {@paperscript}
     * // Creating segments using object notation:
     * var firstSegment = new Segment({
     *     point: [100, 50],
     *     handleOut: [80, 100]
     * });
     *
     * var secondSegment = new Segment({
     *     point: [300, 50],
     *     handleIn: [-80, -100]
     * });
     *
     * var path = new Path({
     *     segments: [firstSegment, secondSegment],
     *     strokeColor: 'black'
     * });
     */
    /**
     * Creates a new Segment object.
     *
     * @param {Number} x the x coordinate of the segment point
     * @param {Number} y the y coordinate of the segment point
     * @param {Number} inX the x coordinate of the the handle point relative to
     * the anchor point of the segment that describes the in tangent of the
     * segment
     * @param {Number} inY the y coordinate of the the handle point relative to
     * the anchor point of the segment that describes the in tangent of the
     * segment
     * @param {Number} outX the x coordinate of the the handle point relative to
     * the anchor point of the segment that describes the out tangent of the
     * segment
     * @param {Number} outY the y coordinate of the the handle point relative to
     * the anchor point of the segment that describes the out tangent of the
     * segment
     *
     * @example {@paperscript}
     * var inX = -80;
     * var inY = -100;
     * var outX = 80;
     * var outY = 100;
     *
     * var x = 100;
     * var y = 50;
     * var firstSegment = new Segment(x, y, inX, inY, outX, outY);
     *
     * var x2 = 300;
     * var y2 = 50;
     * var secondSegment = new Segment( x2, y2, inX, inY, outX, outY);
     *
     * var path = new Path(firstSegment, secondSegment);
     * path.strokeColor = 'black';
     * @ignore
     */
    initialize: function Segment(arg0, arg1, arg2, arg3, arg4, arg5) {
        var count = arguments.length,
            point, handleIn, handleOut, selection;
        // TODO: Should we use Point.read() or Point.readNamed() to read these?
        if (count > 0) {
            if (arg0 == null || typeof arg0 === 'object') {
                // Handle undefined, null and passed objects:
                if (count === 1 && arg0 && 'point' in arg0) {
                    // NOTE: This copies from segments through accessors.
                    point = arg0.point;
                    handleIn = arg0.handleIn;
                    handleOut = arg0.handleOut;
                    selection = arg0.selection;
                } else {
                    // It doesn't matter if all of these arguments exist.
                    // SegmentPoint() creates points with (0, 0) otherwise.
                    point = arg0;
                    handleIn = arg1;
                    handleOut = arg2;
                    selection = arg3;
                }
            } else {
                // Read points from the arguments list as a row of numbers.
                point = [ arg0, arg1 ];
                handleIn = arg2 !== undefined ? [ arg2, arg3 ] : null;
                handleOut = arg4 !== undefined ? [ arg4, arg5 ] : null;
            }
        }
        new SegmentPoint(point, this, '_point');
        new SegmentPoint(handleIn, this, '_handleIn');
        new SegmentPoint(handleOut, this, '_handleOut');
        if (selection)
            this.setSelection(selection);
    },

  
    /**
     * The anchor point of the segment.
     *
     * @bean
     * @type Point
     */
    getPoint: function() {
        return this._point;
    },

    setPoint: function(/* point */) {
        this._point.set(Point.read(arguments));
    },

    /**
     * The handle point relative to the anchor point of the segment that
     * describes the in tangent of the segment.
     *
     * @bean
     * @type Point
     */
    getHandleIn: function() {
        return this._handleIn;
    },

    setHandleIn: function(/* point */) {
        this._handleIn.set(Point.read(arguments));
    },

    /**
     * The handle point relative to the anchor point of the segment that
     * describes the out tangent of the segment.
     *
     * @bean
     * @type Point
     */
    getHandleOut: function() {
        return this._handleOut;
    },

    setHandleOut: function(/* point */) {
        this._handleOut.set(Point.read(arguments));
    },

    /**
     * The curve that the segment belongs to. For the last segment of an open
     * path, the previous segment is returned.
     *
     * @bean
     * @type Curve
     */
    getCurve: function() {
        var path = this._path,
            index = this._index;
        if (path) {
            // The last segment of an open path belongs to the last curve.
            if (index > 0 && !path._closed
                    && index === path._segments.length - 1)
                index--;
            return path.getCurves()[index] || null;
        }
        return null;
    },

  
    /**
     * {@grouptitle Sibling Segments}
     *
     * The next segment in the {@link Path#segments} array that the segment
     * belongs to. If the segments belongs to a closed path, the first segment
     * is returned for the last segment of the path.
     *
     * @bean
     * @type Segment
     */
    getNext: function() {
        var segments = this._path && this._path._segments;
        return segments && (segments[this._index + 1]
                || this._path._closed && segments[0]) || null;
    },


    /**
     * Removes the segment from the path that it belongs to.
     * @return {Boolean} {@true if the segment was removed}
     */
    remove: function() {
        return this._path ? !!this._path.removeSegment(this._index) : false;
    },

    _transformCoordinates: function(matrix, coords, change) {
        // Use matrix.transform version() that takes arrays of multiple
        // points for largely improved performance, as no calls to
        // Point.read() and Point constructors are necessary.
        var point = this._point,
            // If change is true, only transform handles if they are set, as
            // _transformCoordinates is called only to change the segment, no
            // to receive the coords.
            // This saves some computation time. If change is false, always
            // use the real handles, as we just want to receive a filled
            // coords array for getBounds().
            handleIn = !change || !this._handleIn.isZero()
                    ? this._handleIn : null,
            handleOut = !change || !this._handleOut.isZero()
                    ? this._handleOut : null,
            x = point._x,
            y = point._y,
            i = 2;
        coords[0] = x;
        coords[1] = y;
        // We need to convert handles to absolute coordinates in order
        // to transform them.
        if (handleIn) {
            coords[i++] = handleIn._x + x;
            coords[i++] = handleIn._y + y;
        }
        if (handleOut) {
            coords[i++] = handleOut._x + x;
            coords[i++] = handleOut._y + y;
        }
        // If no matrix was previded, this was just called to get the coords and
        // we are done now.
        if (matrix) {
            matrix._transformCoordinates(coords, coords, i / 2);
            x = coords[0];
            y = coords[1];
            if (change) {
                // If change is true, we need to set the new values back
                point._x = x;
                point._y = y;
                i = 2;
                if (handleIn) {
                    handleIn._x = coords[i++] - x;
                    handleIn._y = coords[i++] - y;
                }
                if (handleOut) {
                    handleOut._x = coords[i++] - x;
                    handleOut._y = coords[i++] - y;
                }
            } else {
                // We want to receive the results in coords, so make sure
                // handleIn and out are defined too, even if they're 0
                if (!handleIn) {
                    coords[i++] = x;
                    coords[i++] = y;
                }
                if (!handleOut) {
                    coords[i++] = x;
                    coords[i++] = y;
                }
            }
        }
        return coords;
    }
});
