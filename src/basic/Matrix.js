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

// Based on goog.graphics.AffineTransform, as part of the Closure Library.
// Copyright 2008 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");

/**
 * @name Matrix
 *
 * @class An affine transformation matrix performs a linear mapping from 2D
 *     coordinates to other 2D coordinates that preserves the "straightness" and
 *     "parallelness" of lines.
 *
 * Such a coordinate transformation can be represented by a 3 row by 3
 * column matrix with an implied last row of `[ 0 0 1 ]`. This matrix
 * transforms source coordinates `(x, y)` into destination coordinates `(x',y')`
 * by considering them to be a column vector and multiplying the coordinate
 * vector by the matrix according to the following process:
 *
 *     [ x ]   [ a  c  tx ] [ x ]   [ a * x + c * y + tx ]
 *     [ y ] = [ b  d  ty ] [ y ] = [ b * x + d * y + ty ]
 *     [ 1 ]   [ 0  0  1  ] [ 1 ]   [         1          ]
 *
 * Note the locations of b and c.
 *
 * This class is optimized for speed and minimizes calculations based on its
 * knowledge of the underlying matrix (as opposed to say simply performing
 * matrix multiplication).
 */
var Matrix = Base.extend(/** @lends Matrix# */{
    _class: 'Matrix',

    /**
     * Creates a 2D affine transformation matrix that describes the identity
     * transformation.
     *
     * @name Matrix#initialize
     */
    /**
     * Creates a 2D affine transformation matrix.
     *
     * @name Matrix#initialize
     * @param {Number} a the a property of the transform
     * @param {Number} c the c property of the transform
     * @param {Number} b the b property of the transform
     * @param {Number} d the d property of the transform
     * @param {Number} tx the tx property of the transform
     * @param {Number} ty the ty property of the transform
     */
    /**
     * Creates a 2D affine transformation matrix.
     *
     * @name Matrix#initialize
     * @param {Number[]} values the matrix values to initialize this matrix with
     */
    /**
     * Creates a 2D affine transformation matrix.
     *
     * @name Matrix#initialize
     * @param {Matrix} matrix the matrix to copy the values from
     */
    initialize: function Matrix(arg) {
        var count = arguments.length,
            ok = true;
        if (count === 6) {
            this._set.apply(this, arguments);
        } else if (count === 1) {
            if (arg instanceof Matrix) {
                this._set(arg._a, arg._b, arg._c, arg._d, arg._tx, arg._ty);
            } else if (Array.isArray(arg)) {
                this._set.apply(this, arg);
            } else {
                ok = false;
            }
        } else if (!count) {
            this.reset();
        } else {
            ok = false;
        }
        if (!ok) {
            throw new Error('Unsupported matrix parameters');
        }
        return this;
    },

    /**
     * Sets the matrix to the passed values. Note that any sequence of
     * parameters that is supported by the various {@link Matrix()} constructors
     * also work for calls of `set()`.
     *
     * @function
     */
    set: '#initialize',


   
    _changed: function() {
        var owner = this._owner;
        if (owner) {
            // If owner has #applyMatrix set, directly bake the change in now.
            if (owner._applyMatrix) {
                owner.transform(null, true);
            }
        }
    },

    /**
     * Resets the matrix by setting its values to the ones of the identity
     * matrix that results in no transformation.
     */
    reset: function(_dontNotify) {
        this._a = this._d = 1;
        this._b = this._c = this._tx = this._ty = 0;
        if (!_dontNotify)
            this._changed();
        return this;
    },


    _orNullIfIdentity: function() {
        return this.isIdentity() ? null : this;
    },

    /**
     * @return {Boolean} whether this matrix is the identity matrix
     */
    isIdentity: function() {
        return this._a === 1 && this._b === 0 && this._c === 0 && this._d === 1
                && this._tx === 0 && this._ty === 0;
    },


    /**
     * The translation of the matrix as a vector.
     *
     * @bean
     * @type Point
     */
    getTranslation: function() {
        // No decomposition is required to extract translation.
        return new Point(this._tx, this._ty);
    },
});
