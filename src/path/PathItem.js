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
 * @name PathItem
 *
 * @class The PathItem class is the base for any items that describe paths and
 *     offer standardised methods for drawing and path manipulation, such as
 *     {@link Path} and {@link CompoundPath}.
 *
 * @extends Item
 */
var PathItem = Item.extend(/** @lends PathItem# */{
    _class: 'PathItem',
    _selectBounds: false,
    _canScaleStroke: true,

    initialize: function PathItem() {
        // Do nothing.
    },

    statics: /** @lends PathItem */{
        /**
         * Creates a path item from the given SVG path-data, determining if the
         * data describes a plain path or a compound-path with multiple
         * sub-paths.
         *
         * @name PathItem.create
         * @param {String} pathData the SVG path-data to parse
         * @return {Path|CompoundPath} the newly created path item
         */

        /**
         * Creates a path item from the given segments array, determining if the
         * array describes a plain path or a compound-path with multiple
         * sub-paths.
         *
         * @name PathItem.create
         * @param {Number[][]} segments the segments array to parse
         * @return {Path|CompoundPath} the newly created path item
         */

        /**
         * Creates a path item from the given object, determining if the
         * contained information describes a plain path or a compound-path with
         * multiple sub-paths.
         *
         * @name PathItem.create
         * @param {Object} object an object containing the properties describing
         *     the item to be created
         * @return {Path|CompoundPath} the newly created path item
         */
        create: function(arg) {
            var data,
                segments,
                compound;
            if (Base.isPlainObject(arg)) {
                segments = arg.segments;
                data = arg.pathData;
            } else if (Array.isArray(arg)) {
                segments = arg;
            } else if (typeof arg === 'string') {
                data = arg;
            }
            if (segments) {
                var first = segments[0];
                compound = first && Array.isArray(first[0]);
            } else if (data) {
                // If there are multiple moveTo commands or a closePath command
                // followed by other commands, we have a CompoundPath.
                compound = (data.match(/m/gi) || []).length > 1
                        || /z\s*\S+/i.test(data);
            }
            var ctor = compound ? CompoundPath : Path;
            return new ctor(arg);
        }
    },

    _asPathItem: function() {
        // See Item#_asPathItem()
        return this;
    },

    /**
     * Specifies whether the path as a whole is oriented clock-wise, by looking
     * at the path's area.
     * Note that self-intersecting paths and sub-paths of different orientation
     * can result in areas that cancel each other out.
     *
     * @bean
     * @type Boolean
     * @see Path#getArea()
     * @see CompoundPath#getArea()
     */
    isClockwise: function() {
        return this.getArea() >= 0;
    },

    setClockwise: function(clockwise) {
        // Only revers the path if its clockwise orientation is not the same
        // as what it is now demanded to be.
        // On-the-fly conversion to boolean:
        if (this.isClockwise() != (clockwise = !!clockwise))
            this.reverse();
    },

    /**
     * The path's geometry, formatted as SVG style path data.
     *
     * @name PathItem#getPathData
     * @bean
     * @type String
     */
    setPathData: function(data) {
        // NOTE: #getPathData() is defined in CompoundPath / Path
        // This is a very compact SVG Path Data parser that works both for Path
        // and CompoundPath.

        // First split the path data into parts of command-coordinates pairs
        // Commands are any of these characters: mzlhvcsqta
        var parts = data && data.match(/[mlhvcsqtaz][^mlhvcsqtaz]*/ig),
            coords,
            relative = false,
            previous,
            control,
            current = new Point(),
            start = new Point();

        function getCoord(index, coord) {
            var val = +coords[index];
            if (relative)
                val += current[coord];
            return val;
        }

        function getPoint(index) {
            return new Point(
                getCoord(index, 'x'),
                getCoord(index + 1, 'y')
            );
        }

        // First clear the previous content
        this.clear();

        for (var i = 0, l = parts && parts.length; i < l; i++) {
            var part = parts[i],
                command = part[0],
                lower = command.toLowerCase();
            // Match all coordinate values
            coords = part.match(/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g);
            var length = coords && coords.length;
            relative = command === lower;
            // Fix issues with z in the middle of SVG path data, not followed by
            // a m command, see #413:
            if (previous === 'z' && !/[mz]/.test(lower))
                this.moveTo(current);
            switch (lower) {
            case 'm':
            case 'l':
                var move = lower === 'm';
                for (var j = 0; j < length; j += 2)
                    this[!j && move ? 'moveTo' : 'lineTo'](
                            current = getPoint(j));
                control = current;
                if (move)
                    start = current;
                break;
            case 'h':
            case 'v':
                var coord = lower === 'h' ? 'x' : 'y';
                current = current.clone(); // Clone as we're going to modify it.
                for (var j = 0; j < length; j++) {
                    current[coord] = getCoord(j, coord);
                    this.lineTo(current);
                }
                control = current;
                break;
            case 'c':
                for (var j = 0; j < length; j += 6) {
                    this.cubicCurveTo(
                            getPoint(j),
                            control = getPoint(j + 2),
                            current = getPoint(j + 4));
                }
                break;
            case 's':
                // Smooth cubicCurveTo
                for (var j = 0; j < length; j += 4) {
                    this.cubicCurveTo(
                            /[cs]/.test(previous)
                                    ? current.multiply(2).subtract(control)
                                    : current,
                            control = getPoint(j),
                            current = getPoint(j + 2));
                    previous = lower;
                }
                break;
            case 'q':
                for (var j = 0; j < length; j += 4) {
                    this.quadraticCurveTo(
                            control = getPoint(j),
                            current = getPoint(j + 2));
                }
                break;
            case 't':
                // Smooth quadraticCurveTo
                for (var j = 0; j < length; j += 2) {
                    this.quadraticCurveTo(
                            control = (/[qt]/.test(previous)
                                    ? current.multiply(2).subtract(control)
                                    : current),
                            current = getPoint(j));
                    previous = lower;
                }
                break;
            case 'a':
                for (var j = 0; j < length; j += 7) {
                    this.arcTo(current = getPoint(j + 5),
                            new Size(+coords[j], +coords[j + 1]),
                            +coords[j + 2], +coords[j + 4], +coords[j + 3]);
                }
                break;
            case 'z':
                // Merge first and last segment with Numerical.EPSILON tolerance
                // to address imprecisions in relative SVG data.
                this.closePath(/*#=*/Numerical.EPSILON);
                // Correctly handle relative m commands, see #1101:
                current = start;
                break;
            }
            previous = lower;
        }
    },


    _contains: function(point) {
        // !__options.nativeContains && __options.booleanOperations
        // Check the transformed point against the untransformed (internal)
        // handle bounds, which is the fastest rough bounding box to calculate
        // for a quick check before calculating the actual winding.
        var winding = point.isInside(
                this.getBounds({ internal: true, handle: true }))
                    ? this._getWinding(point)
                    : {};
        return !!(this.getFillRule() === 'evenodd'
                ? winding.windingL & 1 || winding.windingR & 1
                : winding.winding);
    },

    /**
     * {@grouptitle Path Intersections and Locations}
     *
     * Returns all intersections between two {@link PathItem} items as an array
     * of {@link CurveLocation} objects. {@link CompoundPath} items are also
     * supported.
     *
     * @param {PathItem} path the other item to find the intersections with
     * @param {Function} [include] a callback function that can be used to
     *     filter out undesired locations right while they are collected. When
     *     defined, it shall return {@true to include a location}.
     * @return {CurveLocation[]} the locations of all intersection between the
     *     paths
     * @see #getCrossings(path)
     * @example {@paperscript} // Finding the intersections between two paths
     * var path = new Path.Rectangle(new Point(30, 25), new Size(50, 50));
     * path.strokeColor = 'black';
     *
     * var secondPath = path.clone();
     * var intersectionGroup = new Group();
     *
     * function onFrame(event) {
     *     secondPath.rotate(1);
     *
     *     var intersections = path.getIntersections(secondPath);
     *     intersectionGroup.removeChildren();
     *
     *     for (var i = 0; i < intersections.length; i++) {
     *         var intersectionPath = new Path.Circle({
     *             center: intersections[i].point,
     *             radius: 4,
     *             fillColor: 'red',
     *             parent: intersectionGroup
     *         });
     *     }
     * }
     */
    getIntersections: function(path, include, _matrix, _returnFirst) {
        // NOTE: For self-intersection, path is null. This means you can also
        // just call path.getIntersections() without an argument to get self
        // intersections.
        // NOTE: The hidden argument _matrix is used internally to override the
        // passed path's transformation matrix.
        var self = this === path || !path, // self-intersections?
            matrix1 = this._matrix._orNullIfIdentity(),
            matrix2 = self ? matrix1
                : (_matrix || path._matrix)._orNullIfIdentity();
        // First check the bounds of the two paths. If they don't intersect,
        // we don't need to iterate through their curves.
        if (!self && !this.getBounds(matrix1).touches(path.getBounds(matrix2)))
            return [];
        var curves1 = this.getCurves(),
            curves2 = self ? curves1 : path.getCurves(),
            length1 = curves1.length,
            length2 = self ? length1 : curves2.length,
            values2 = [],
            arrays = [],
            locations,
            path;
        // Cache values for curves2 as we re-iterate them for each in curves1.
        for (var i = 0; i < length2; i++)
            values2[i] = curves2[i].getValues(matrix2);
        for (var i = 0; i < length1; i++) {
            var curve1 = curves1[i],
                values1 = self ? values2[i] : curve1.getValues(matrix1),
                path1 = curve1.getPath();
            // NOTE: Due to the nature of Curve._getIntersections(), we need to
            // use separate location arrays per path1, to make sure the
            // circularity checks are not getting confused by locations on
            // separate paths. We are flattening the separate arrays at the end.
            if (path1 !== path) {
                path = path1;
                locations = [];
                arrays.push(locations);
            }
            if (self) {
                // First check for self-intersections within the same curve.
                Curve._getSelfIntersection(values1, curve1, locations, {
                    include: include,
                    // Only possible if there is only one closed curve:
                    excludeStart: length1 === 1 &&
                            curve1.getPoint1().equals(curve1.getPoint2())
                });
            }
            // Check for intersections with other curves. For self intersection,
            // we can start at i + 1 instead of 0
            for (var j = self ? i + 1 : 0; j < length2; j++) {
                // There might be already one location from the above
                // self-intersection check:
                if (_returnFirst && locations.length)
                    return locations;
                var curve2 = curves2[j];
                // Avoid end point intersections on consecutive curves when
                // self intersecting.
                Curve._getIntersections(
                    values1, values2[j], curve1, curve2, locations,
                    {
                        include: include,
                        // Do not compare indices here to determine connection,
                        // since one array of curves can contain curves from
                        // separate sup-paths of a compound path.
                        excludeStart: self && curve1.getPrevious() === curve2,
                        excludeEnd: self && curve1.getNext() === curve2
                    }
                );
            }
        }
        // Now flatten the list of location arrays to one array and return it.
        locations = [];
        for (var i = 0, l = arrays.length; i < l; i++) {
            locations.push.apply(locations, arrays[i]);
        }
        return locations;
    },

    /**
     * Returns all crossings between two {@link PathItem} items as an array of
     * {@link CurveLocation} objects. {@link CompoundPath} items are also
     * supported. Crossings are intersections where the paths actually are
     * crossing each other, as opposed to simply touching.
     *
     * @param {PathItem} path the other item to find the crossings with
     * @see #getIntersections(path)
     */
    getCrossings: function(path) {
        return this.getIntersections(path, function(inter) {
            // TODO: Only return overlaps that are actually crossings! For this
            // we need proper overlap range detection / merging first...
            // But as we call #resolveCrossings() first in boolean operations,
            // removing all self-touching areas in paths, this currently works
            // as it should in the known use cases.
            // The ideal implementation would deal with it in a way outlined in:
            // https://github.com/paperjs/paper.js/issues/874#issuecomment-168332391
            return inter._overlap || inter.isCrossing();
        });
    },

});
