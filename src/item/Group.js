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
 * @name Group
 *
 * @class A Group is a collection of items. When you transform a Group, its
 * children are treated as a single unit without changing their relative
 * positions.
 *
 * @extends Item
 */
var Group = Item.extend(/** @lends Group# */{
    _class: 'Group',
    _selectBounds: false,
    _selectChildren: true,
    _serializeFields: {
        children: []
    },

    initialize: function Group(arg) {
        // Allow Group to have children and named children
        this._children = [];
        this._namedChildren = {};
        if (!this._initialize(arg))
            this.addChildren(Array.isArray(arg) ? arg : arguments);
    }
});
