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

    // DOCS: document new Group(item, item...);
    /**
     * Creates a new Group item and places it at the top of the active layer.
     *
     * @name Group#initialize
     * @param {Item[]} [children] An array of children that will be added to the
     * newly created group
     *
     * @example {@paperscript}
     * // Create a group containing two paths:
     * var path = new Path([100, 100], [100, 200]);
     * var path2 = new Path([50, 150], [150, 150]);
     *
     * // Create a group from the two paths:
     * var group = new Group([path, path2]);
     *
     * // Set the stroke color of all items in the group:
     * group.strokeColor = 'black';
     *
     * // Move the group to the center of the view:
     * group.position = view.center;
     *
     * @example {@paperscript height=320}
     * // Click in the view to add a path to the group, which in turn is rotated
     * // every frame:
     * var group = new Group();
     *
     * function onMouseDown(event) {
     *     // Create a new circle shaped path at the position
     *     // of the mouse:
     *     var path = new Path.Circle(event.point, 5);
     *     path.fillColor = 'black';
     *
     *     // Add the path to the group's children list:
     *     group.addChild(path);
     * }
     *
     * function onFrame(event) {
     *     // Rotate the group by 1 degree from
     *     // the centerpoint of the view:
     *     group.rotate(1, view.center);
     * }
     */
    /**
     * Creates a new Group item and places it at the top of the active layer.
     *
     * @name Group#initialize
     * @param {Object} object an object containing the properties to be set on
     *     the group
     *
     * @example {@paperscript}
     * var path = new Path([100, 100], [100, 200]);
     * var path2 = new Path([50, 150], [150, 150]);
     *
     * // Create a group from the two paths:
     * var group = new Group({
     *     children: [path, path2],
     *     // Set the stroke color of all items in the group:
     *     strokeColor: 'black',
     *     // Move the group to the center of the view:
     *     position: view.center
     * });
     */
    initialize: function Group(arg) {
        // Allow Group to have children and named children
        this._children = [];
        this._namedChildren = {};
        if (!this._initialize(arg))
            this.addChildren(Array.isArray(arg) ? arg : arguments);
    },

    _changed: function _changed(flags) {
        _changed.base.call(this, flags);
        if (flags & /*#=*/(ChangeFlag.CHILDREN | ChangeFlag.CLIPPING)) {
            // Clear cached clip item whenever hierarchy changes
            this._clipItem = undefined;
        }
    },
});
