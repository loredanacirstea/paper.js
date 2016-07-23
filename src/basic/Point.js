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
 * @name Point
 *
 * @class The Point object represents a point in the two dimensional space
 * of the Paper.js project. It is also used to represent two dimensional
 * vector objects.
 *
 * @classexample
 * // Create a point at x: 10, y: 5
 * var point = new Point(10, 5);
 * console.log(point.x); // 10
 * console.log(point.y); // 5
 */
var Point = Base.extend(/** @lends Point# */{
    _class: 'Point',
    // Tell Base.read that the Point constructor supports reading with index
    _readIndex: true,


    initialize: function Point(arg0, arg1) {
        var type = typeof arg0,
            reading = this.__read,
            read = 0;
        if (type === 'number') {
            var hasY = typeof arg1 === 'number';
            this._set(arg0, hasY ? arg1 : arg0);
            if (reading)
                read = hasY ? 2 : 1;
        } else if (type === 'undefined' || arg0 === null) {
            this._set(0, 0);
            if (reading)
                read = arg0 === null ? 1 : 0;
        } else {
            var obj = type === 'string' ? arg0.split(/[\s,]+/) || [] : arg0;
            read = 1;
            if (Array.isArray(obj)) {
                this._set(+obj[0], +(obj.length > 1 ? obj[1] : obj[0]));
            } else if ('x' in obj) {
                this._set(obj.x || 0, obj.y || 0);
            } else if ('width' in obj) {
                this._set(obj.width || 0, obj.height || 0);
            } else if ('angle' in obj) {
                this._set(obj.length || 0, 0);
                this.setAngle(obj.angle || 0);
            } else {
                this._set(0, 0);
                read = 0;
            }
        }
        if (reading)
            this.__read = read;
        return this;
    },

    /**
     * Sets the point to the passed values. Note that any sequence of parameters
     * that is supported by the various {@link Point()} constructors also work
     * for calls of `set()`.
     *
     * @function
     */
    set: '#initialize',

    /**
     * Internal helper function to directly set the underlying properties.
     *
     * Convention regarding {@link #set()} VS {@link #_set()}:
     *
     * - {@link #_set()} is for actually setting properties, e.g. on Point,
     *   Size, so that derived classes can reuse other parts (e.g. SegmentPoint)
     * - {@link #set()} is a shortcut to #initialize() on all basic types, to
     *   offer the same amount of flexibility when setting values.
     */
    _set: function(x, y) {
        this.x = x;
        this.y = y;
        return this;
    },

 
    /**
     * Returns a copy of the point.
     *
     * @example
     * var point1 = new Point();
     * var point2 = point1;
     * point2.x = 1; // also changes point1.x
     *
     * var point2 = point1.clone();
     * point2.x = 1; // doesn't change point1.x
     *
     * @return {Point} the cloned point
     */
    clone: function() {
        return new Point(this.x, this.y);
    },

    /**
     * The length of the vector that is represented by this point's coordinates.
     * Each point can be interpreted as a vector that points from the origin (`x
     * = 0`, `y = 0`) to the point's location. Setting the length changes the
     * location but keeps the vector's angle.
     *
     * @bean
     * @type Number
     */
    getLength: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    setLength: function(length) {
        // Whenever chaining both x & y, use #set() instead of direct
        // assignment, so LinkedPoint does not report changes twice.
        if (this.isZero()) {
            var angle = this._angle || 0;
            this._set(
                Math.cos(angle) * length,
                Math.sin(angle) * length
            );
        } else {
            var scale = length / this.getLength();
            // Force calculation of angle now, so it will be preserved even when
            // x and y are 0
            if (Numerical.isZero(scale))
                this.getAngle();
            this._set(
                this.x * scale,
                this.y * scale
            );
        }
    },


}, /** @lends Point# */{
    // Explicitly deactivate the creation of beans, as we have functions here
    // that look like bean getters but actually read arguments.
    // See #getDirectedAngle(), #getDistance()
    beans: false,

    
    /**
     * Returns the distance between the point and another point.
     *
     * @param {Point} point
     * @param {Boolean} [squared=false] Controls whether the distance should
     * remain squared, or its square root should be calculated
     * @return {Number}
     */
    getDistance: function(/* point, squared */) {
        var point = Point.read(arguments),
            x = point.x - this.x,
            y = point.y - this.y,
            d = x * x + y * y,
            squared = Base.read(arguments);
        return squared ? d : Math.sqrt(d);
    },

    /**
     * Normalize modifies the {@link #length} of the vector to `1` without
     * changing its angle and returns it as a new point. The optional `length`
     * parameter defines the length to normalize to. The object itself is not
     * modified!
     *
     * @param {Number} [length=1] The length of the normalized vector
     * @return {Point} the normalized vector of the vector that is represented
     *     by this point's coordinates
     */
    normalize: function(length) {
        if (length === undefined)
            length = 1;
        var current = this.getLength(),
            scale = current !== 0 ? length / current : 0,
            point = new Point(this.x * scale, this.y * scale);
        // Preserve angle.
        if (scale >= 0)
            point._angle = this._angle;
        return point;
    },

    /**
     * Transforms the point by the matrix as a new point. The object itself is
     * not modified!
     *
     * @param {Matrix} matrix
     * @return {Point} the transformed point
     */
    transform: function(matrix) {
        return matrix ? matrix._transformPoint(this) : this;
    },

    /**
     * Returns the addition of the supplied value to both coordinates of
     * the point as a new point.
     * The object itself is not modified!
     *
     * @name Point#add
     * @function
     * @operator
     * @param {Number} number the number to add
     * @return {Point} the addition of the point and the value as a new point
     *
     * @example
     * var point = new Point(5, 10);
     * var result = point + 20;
     * console.log(result); // {x: 25, y: 30}
     */
    /**
     * Returns the addition of the supplied point to the point as a new
     * point.
     * The object itself is not modified!
     *
     * @name Point#add
     * @function
     * @operator
     * @param {Point} point the point to add
     * @return {Point} the addition of the two points as a new point
     *
     * @example
     * var point1 = new Point(5, 10);
     * var point2 = new Point(10, 20);
     * var result = point1 + point2;
     * console.log(result); // {x: 15, y: 30}
     */
    add: function(/* point */) {
        var point = Point.read(arguments);
        return new Point(this.x + point.x, this.y + point.y);
    },

    /**
     * Returns the subtraction of the supplied value to both coordinates of
     * the point as a new point.
     * The object itself is not modified!
     *
     * @name Point#subtract
     * @function
     * @operator
     * @param {Number} number the number to subtract
     * @return {Point} the subtraction of the point and the value as a new point
     *
     * @example
     * var point = new Point(10, 20);
     * var result = point - 5;
     * console.log(result); // {x: 5, y: 15}
     */
    /**
     * Returns the subtraction of the supplied point to the point as a new
     * point.
     * The object itself is not modified!
     *
     * @name Point#subtract
     * @function
     * @operator
     * @param {Point} point the point to subtract
     * @return {Point} the subtraction of the two points as a new point
     *
     * @example
     * var firstPoint = new Point(10, 20);
     * var secondPoint = new Point(5, 5);
     * var result = firstPoint - secondPoint;
     * console.log(result); // {x: 5, y: 15}
     */
    subtract: function(/* point */) {
        var point = Point.read(arguments);
        return new Point(this.x - point.x, this.y - point.y);
    },

    /**
     * Returns the multiplication of the supplied value to both coordinates of
     * the point as a new point.
     * The object itself is not modified!
     *
     * @name Point#multiply
     * @function
     * @operator
     * @param {Number} number the number to multiply by
     * @return {Point} the multiplication of the point and the value as a new
     *     point
     *
     * @example
     * var point = new Point(10, 20);
     * var result = point * 2;
     * console.log(result); // {x: 20, y: 40}
     */
    /**
     * Returns the multiplication of the supplied point to the point as a new
     * point.
     * The object itself is not modified!
     *
     * @name Point#multiply
     * @function
     * @operator
     * @param {Point} point the point to multiply by
     * @return {Point} the multiplication of the two points as a new point
     *
     * @example
     * var firstPoint = new Point(5, 10);
     * var secondPoint = new Point(4, 2);
     * var result = firstPoint * secondPoint;
     * console.log(result); // {x: 20, y: 20}
     */
    multiply: function(/* point */) {
        var point = Point.read(arguments);
        return new Point(this.x * point.x, this.y * point.y);
    },

    /**
     * Returns the division of the supplied value to both coordinates of
     * the point as a new point.
     * The object itself is not modified!
     *
     * @name Point#divide
     * @function
     * @operator
     * @param {Number} number the number to divide by
     * @return {Point} the division of the point and the value as a new point
     *
     * @example
     * var point = new Point(10, 20);
     * var result = point / 2;
     * console.log(result); // {x: 5, y: 10}
     */
    /**
     * Returns the division of the supplied point to the point as a new
     * point.
     * The object itself is not modified!
     *
     * @name Point#divide
     * @function
     * @operator
     * @param {Point} point the point to divide by
     * @return {Point} the division of the two points as a new point
     *
     * @example
     * var firstPoint = new Point(8, 10);
     * var secondPoint = new Point(2, 5);
     * var result = firstPoint / secondPoint;
     * console.log(result); // {x: 4, y: 2}
     */
    divide: function(/* point */) {
        var point = Point.read(arguments);
        return new Point(this.x / point.x, this.y / point.y);
    },

    /**
     * The modulo operator returns the integer remainders of dividing the point
     * by the supplied value as a new point.
     *
     * @name Point#modulo
     * @function
     * @operator
     * @param {Number} value
     * @return {Point} the integer remainders of dividing the point by the value
     * as a new point
     *
     * @example
     * var point = new Point(12, 6);
     * console.log(point % 5); // {x: 2, y: 1}
     */
    /**
     * The modulo operator returns the integer remainders of dividing the point
     * by the supplied value as a new point.
     *
     * @name Point#modulo
     * @function
     * @operator
     * @param {Point} point
     * @return {Point} the integer remainders of dividing the points by each
     * other as a new point
     *
     * @example
     * var point = new Point(12, 6);
     * console.log(point % new Point(5, 2)); // {x: 2, y: 0}
     */
    modulo: function(/* point */) {
        var point = Point.read(arguments);
        return new Point(this.x % point.x, this.y % point.y);
    },

    negate: function() {
        return new Point(-this.x, -this.y);
    },

    /**
     * {@grouptitle Tests}
     *
     * Checks whether the point is inside the boundaries of the rectangle.
     *
     * @param {Rectangle} rect the rectangle to check against
     * @return {Boolean} {@true if the point is inside the rectangle}
     */
    isInside: function(/* rect */) {
        return Rectangle.read(arguments).contains(this);
    },

    /**
     * Checks if the point is within a given distance of another point.
     *
     * @param {Point} point the point to check against
     * @param {Number} tolerance the maximum distance allowed
     * @return {Boolean} {@true if it is within the given distance}
     */
    isClose: function(/* point, tolerance */) {
        var point = Point.read(arguments),
            tolerance = Base.read(arguments);
        return this.getDistance(point) <= tolerance;
    },

    /**
     * Checks if the vector represented by this point is collinear (parallel) to
     * another vector.
     *
     * @param {Point} point the vector to check against
     * @return {Boolean} {@true it is collinear}
     */
    isCollinear: function(/* point */) {
        var point = Point.read(arguments);
        return Point.isCollinear(this.x, this.y, point.x, point.y);
    },

    // TODO: Remove version with typo after a while (deprecated June 2015)
    isColinear: '#isCollinear',

    /**
     * Checks if the vector represented by this point is orthogonal
     * (perpendicular) to another vector.
     *
     * @param {Point} point the vector to check against
     * @return {Boolean} {@true it is orthogonal}
     */
    isOrthogonal: function(/* point */) {
        var point = Point.read(arguments);
        return Point.isOrthogonal(this.x, this.y, point.x, point.y);
    },

    /**
     * Checks if this point has both the x and y coordinate set to 0.
     *
     * @return {Boolean} {@true if both x and y are 0}
     */
    isZero: function() {
        return Numerical.isZero(this.x) && Numerical.isZero(this.y);
    },

    /**
     * Checks if this point has an undefined value for at least one of its
     * coordinates.
     *
     * @return {Boolean} {@true if either x or y are not a number}
     */
    isNaN: function() {
        return isNaN(this.x) || isNaN(this.y);
    },

    /**
     * {@grouptitle Vector Math Functions}
     * Returns the dot product of the point and another point.
     *
     * @param {Point} point
     * @return {Number} the dot product of the two points
     */
    dot: function(/* point */) {
        var point = Point.read(arguments);
        return this.x * point.x + this.y * point.y;
    },

    /**
     * Returns the cross product of the point and another point.
     *
     * @param {Point} point
     * @return {Number} the cross product of the two points
     */
    cross: function(/* point */) {
        var point = Point.read(arguments);
        return this.x * point.y - this.y * point.x;
    },

    /**
     * Returns the projection of the point onto another point.
     * Both points are interpreted as vectors.
     *
     * @param {Point} point
     * @return {Point} the projection of the point onto another point
     */
    project: function(/* point */) {
        var point = Point.read(arguments),
            scale = point.isZero() ? 0 : this.dot(point) / point.dot(point);
        return new Point(
            point.x * scale,
            point.y * scale
        );
    },


    statics: /** @lends Point */{
        /**
         * Returns a new point object with the smallest {@link #x} and
         * {@link #y} of the supplied points.
         *
         * @static
         * @param {Point} point1
         * @param {Point} point2
         * @return {Point} the newly created point object
         *
         * @example
         * var point1 = new Point(10, 100);
         * var point2 = new Point(200, 5);
         * var minPoint = Point.min(point1, point2);
         * console.log(minPoint); // {x: 10, y: 5}
         *
         * @example
         * // Find the minimum of multiple points:
         * var point1 = new Point(60, 100);
         * var point2 = new Point(200, 5);
         * var point3 = new Point(250, 35);
         * [point1, point2, point3].reduce(Point.min) // {x: 60, y: 5}
         */
        min: function(/* point1, point2 */) {
            var point1 = Point.read(arguments),
                point2 = Point.read(arguments);
            return new Point(
                Math.min(point1.x, point2.x),
                Math.min(point1.y, point2.y)
            );
        },

        /**
         * Returns a new point object with the largest {@link #x} and
         * {@link #y} of the supplied points.
         *
         * @static
         * @param {Point} point1
         * @param {Point} point2
         * @return {Point} the newly created point object
         *
         * @example
         * var point1 = new Point(10, 100);
         * var point2 = new Point(200, 5);
         * var maxPoint = Point.max(point1, point2);
         * console.log(maxPoint); // {x: 200, y: 100}
         *
         * @example
         * // Find the maximum of multiple points:
         * var point1 = new Point(60, 100);
         * var point2 = new Point(200, 5);
         * var point3 = new Point(250, 35);
         * [point1, point2, point3].reduce(Point.max) // {x: 250, y: 100}
         */
        max: function(/* point1, point2 */) {
            var point1 = Point.read(arguments),
                point2 = Point.read(arguments);
            return new Point(
                Math.max(point1.x, point2.x),
                Math.max(point1.y, point2.y)
            );
        },

        /**
         * Returns a point object with random {@link #x} and {@link #y} values
         * between `0` and `1`.
         *
         * @return {Point} the newly created point object
         * @static
         *
         * @example
         * var maxPoint = new Point(100, 100);
         * var randomPoint = Point.random();
         *
         * // A point between {x:0, y:0} and {x:100, y:100}:
         * var point = maxPoint * randomPoint;
         */
        random: function() {
            return new Point(Math.random(), Math.random());
        },

        isCollinear: function(x1, y1, x2, y2) {
            // NOTE: We use normalized vectors so that the epsilon comparison is
            // reliable. We could instead scale the epsilon based on the vector
            // length. But instead of normalizing the vectors before calculating
            // the cross product, we can scale the epsilon accordingly.
            return Math.abs(x1 * y2 - y1 * x2)
                    <= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
                        * /*#=*/Numerical.TRIGONOMETRIC_EPSILON;
        },

        isOrthogonal: function(x1, y1, x2, y2) {
            // See Point.isCollinear()
            return Math.abs(x1 * x2 + y1 * y2)
                    <= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
                        * /*#=*/Numerical.TRIGONOMETRIC_EPSILON;
        }
    }
}, Base.each(['round', 'ceil', 'floor', 'abs'], function(key) {
    // Inject round, ceil, floor, abs:
    var op = Math[key];
    this[key] = function() {
        return new Point(op(this.x), op(this.y));
    };
}, {}));

