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
 * @name Item
 *
 * @class The Item type allows you to access and modify the items in
 * Paper.js projects. Its functionality is inherited by different project
 * item types such as {@link Path}, {@link CompoundPath}, {@link Group},
 * {@link Layer} and {@link Raster}. They each add a layer of functionality that
 * is unique to their type, but share the underlying properties and functions
 * that they inherit from Item.
 */
var Item = Base.extend(Emitter, /** @lends Item# */{
    statics: /** @lends Item */{
        /**
         * Override Item.extend() to merge the subclass' _serializeFields with
         * the parent class' _serializeFields.
         *
         * @private
         */
        extend: function extend(src) {
            if (src._serializeFields)
                src._serializeFields = Base.set({},
                    this.prototype._serializeFields, src._serializeFields);
            return extend.base.apply(this, arguments);
        },

        /**
         * An object constant that can be passed to Item#initialize() to avoid
         * insertion into the scene graph.
         *
         * @private
         */
        NO_INSERT: { insert: false }
    },

    _class: 'Item',
    _name: null,
    // All items apply their matrix by default.
    // Exceptions are Raster, SymbolItem, Clip and Shape.
    _applyMatrix: true,
    _canApplyMatrix: true,
    _canScaleStroke: false,
    _pivot: null,
    _visible: true,
    _blendMode: 'normal',
    _opacity: 1,
    _locked: false,
    _guide: false,
    _clipMask: false,
    _selection: 0,
    // Controls whether bounds should appear selected when the item is selected.
    // This is only turned off for Group, Layer and PathItem, where it can be
    // selected separately by setting item.bounds.selected = true;
    _selectBounds: true,
    _selectChildren: false,
    // Provide information about fields to be serialized, with their defaults
    // that can be omitted.
    _serializeFields: {
        name: null,
        applyMatrix: null,
        matrix: new Matrix(),
        pivot: null,
        visible: true,
        blendMode: 'normal',
        opacity: 1,
        locked: false,
        guide: false,
        clipMask: false,
        selected: false,
        data: {}
    }
},
new function() { // Injection scope for various item event handlers
    var handlers = ['onMouseDown', 'onMouseUp', 'onMouseDrag', 'onClick',
            'onDoubleClick', 'onMouseMove', 'onMouseEnter', 'onMouseLeave'];
    return Base.each(handlers,
        function(name) {
            this._events[name] = {
                install: function(type) {
                    this.getView()._countItemEvent(type, 1);
                },

                uninstall: function(type) {
                    this.getView()._countItemEvent(type, -1);
                }
            };
        }, {
            _events: {
                onFrame: {
                    install: function() {
                        this.getView()._animateItem(this, true);
                    },

                    uninstall: function() {
                        this.getView()._animateItem(this, false);
                    }
                },

                // Only for external sources, e.g. Raster
                onLoad: {},
                onError: {}
            },
            statics: {
                _itemHandlers: handlers
            }
        }
    );
}, /** @lends Item# */{
    initialize: function Item() {
        // Do nothing, but declare it for named constructors.
    },

    /**
     * Private helper for #initialize() that tries setting properties from the
     * passed props object, and apply the point translation to the internal
     * matrix.
     *
     * @param {Object} props the properties to be applied to the item
     * @param {Point} point the point by which to transform the internal matrix
     * @return {Boolean} {@true if the properties were successfully be applied,
     * or if none were provided}
     */
    _initialize: function(props, point) {
        // Define this Item's unique id. But allow the creation of internally
        // used paths with no ids.
        var hasProps = props && Base.isPlainObject(props),
            internal = hasProps && props.internal === true,
            matrix = this._matrix = new Matrix(),
            // Allow setting another project than the currently active one.
            project = hasProps && props.project || paper.project,
            settings = paper.settings;
        this._id = internal ? null : UID.get();
        this._parent = this._index = null;
        // Inherit the applyMatrix setting from settings.applyMatrix
        this._applyMatrix = this._canApplyMatrix && settings.applyMatrix;
        // Handle matrix before everything else, to avoid issues with
        // #addChild() calling _changed() and accessing _matrix already.
        if (point)
            matrix.translate(point);
        matrix._owner = this;
        //this._style = new Style(project._currentStyle, this, project);
        // Do not add to the project if it's an internal path,  or if
        // props.insert  or settings.isnertItems is false.
        if (internal || hasProps && props.insert === false
            || !settings.insertItems && !(hasProps && props.insert === true)) {
            this._setProject(project);
        } else {
            (hasProps && props.parent || project)
                    ._insertItem(undefined, this, true); // _created = true
        }
        // Filter out Item.NO_INSERT before _set(), for performance reasons.
        if (hasProps && props !== Item.NO_INSERT) {
            // Filter out internal, insert, parent and project properties as
            // these were handled above.
            Base.filter(this, props, {
                internal: true, insert: true, project: true, parent: true
            });
        }
        return hasProps;
    },

 

    /**
     * Private notifier that is called whenever a change occurs in this item or
     * its sub-elements, such as Segments, Curves, Styles, etc.
     *
     * @param {ChangeFlag} flags describes what exactly has changed
     */
    _changed: function(flags) {
        var symbol = this._symbol,
            cacheParent = this._parent || symbol,
            project = this._project;
        if (flags & /*#=*/ChangeFlag.GEOMETRY) {
            // Clear cached bounds, position and decomposed matrix whenever
            // geometry changes.
            this._bounds = this._position = this._decomposed =
                    this._globalMatrix = undefined;
        }
        if (cacheParent
                && (flags & /*#=*/(ChangeFlag.GEOMETRY | ChangeFlag.STROKE))) {
            // Clear cached bounds of all items that this item contributes to.
            // We call this on the parent, since the information is cached on
            // the parent, see getBounds().
            Item._clearBoundsCache(cacheParent);
        }
        if (flags & /*#=*/ChangeFlag.CHILDREN) {
            // Clear cached bounds of all items that this item contributes to.
            // Here we don't call this on the parent, since adding / removing a
            // child triggers this notification on the parent.
            Item._clearBoundsCache(this);
        }
        if (project)
            project._changed(flags, this);
        // If this item is a symbol's definition, notify it of the change too
        if (symbol)
            symbol._changed(flags);
    },

    /**
     * Sets the properties of the passed object literal on this item to the
     * values defined in the object literal, if the item has property of the
     * given name (or a setter defined for it).
     *
     * @param {Object} props
     * @return {Item} the item itself
     *
     * @example {@paperscript}
     * // Setting properties through an object literal
     * var circle = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });
     *
     * circle.set({
     *     strokeColor: 'red',
     *     strokeWidth: 10,
     *     fillColor: 'black',
     *     selected: true
     * });
     */
    set: function(props) {
        if (props)
            this._set(props);
        return this;
    },

    /**
     * The unique id of the item.
     *
     * @bean
     * @type Number
     */
    getId: function() {
        return this._id;
    },

    /**
     * The class name of the item as a string.
     *
     * @name Item#className
     * @type String
     * @values 'Group', 'Layer', 'Path', 'CompoundPath', 'Shape', 'Raster',
     *     'SymbolItem', 'PointText'
     */

    /**
     * The name of the item. If the item has a name, it can be accessed by name
     * through its parent's children list.
     *
     * @bean
     * @type String
     *
     * @example {@paperscript}
     * var path = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });

     * // Set the name of the path:
     * path.name = 'example';
     *
     * // Create a group and add path to it as a child:
     * var group = new Group();
     * group.addChild(path);
     *
     * // The path can be accessed by name:
     * group.children['example'].fillColor = 'red';
     */
    getName: function() {
        return this._name;
    },

    setName: function(name) {
        // NOTE: Don't check if the name has changed and bail out if it has not,
        // because setName is used internally also to update internal structures
        // when an item is moved from one parent to another.

        // If the item already had a name, remove the reference to it from the
        // parent's children object:
        if (this._name)
            this._removeNamed();
        // See if the name is a simple number, which we cannot support due to
        // the named lookup on the children array.
        if (name === (+name) + '')
            throw new Error(
                    'Names consisting only of numbers are not supported.');
        var owner = this._getOwner();
        if (name && owner) {
            var children = owner._children,
                namedChildren = owner._namedChildren;
            (namedChildren[name] = namedChildren[name] || []).push(this);
            // Only set this item if there isn't one under the same name already
            if (!(name in children))
                children[name] = this;
        }
        this._name = name || undefined;
        this._changed(/*#=*/ChangeFlag.ATTRIBUTE);
    },

  
},  /** @lends Item# */{
    // Enforce creation of beans, as bean getters have hidden parameters.
    // See #getPosition() below.
    beans: true,

    // NOTE: These properties have their getter / setters produced in the
    // injection scope above.

    /**
     * Specifies whether the item is locked.
     *
     * @name Item#locked
     * @type Boolean
     * @default false
     * @ignore
     */

    /**
     * Specifies whether the item is visible. When set to `false`, the item
     * won't be drawn.
     *
     * @name Item#visible
     * @type Boolean
     * @default true
     *
     * @example {@paperscript}
     * // Hiding an item:
     * var path = new Path.Circle({
     *     center: [50, 50],
     *     radius: 20,
     *     fillColor: 'red'
     * });
     *
     * // Hide the path:
     * path.visible = false;
     */

    /**
     * The blend mode with which the item is composited onto the canvas. Both
     * the standard canvas compositing modes, as well as the new CSS blend modes
     * are supported. If blend-modes cannot be rendered natively, they are
     * emulated. Be aware that emulation can have an impact on performance.
     *
     * @name Item#blendMode
     * @type String
     * @values 'normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-
     *     light', 'color-dodge', 'color-burn', 'darken', 'lighten',
     *     'difference', 'exclusion', 'hue', 'saturation', 'luminosity',
     *     'color', 'add', 'subtract', 'average', 'pin-light', 'negation',
     *     'source- over', 'source-in', 'source-out', 'source-atop',
     *     'destination-over', 'destination-in', 'destination-out',
     *     'destination-atop', 'lighter', 'darker', 'copy', 'xor'
     * @default 'normal'
     *
     * @example {@paperscript}
     * // Setting an item's blend mode:
     *
     * // Create a white rectangle in the background
     * // with the same dimensions as the view:
     * var background = new Path.Rectangle(view.bounds);
     * background.fillColor = 'white';
     *
     * var circle = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35,
     *     fillColor: 'red'
     * });
     *
     * var circle2 = new Path.Circle({
     *     center: new Point(120, 50),
     *     radius: 35,
     *     fillColor: 'blue'
     * });
     *
     * // Set the blend mode of circle2:
     * circle2.blendMode = 'multiply';
     */

    /**
     * The opacity of the item as a value between `0` and `1`.
     *
     * @name Item#opacity
     * @type Number
     * @default 1
     *
     * @example {@paperscript}
     * // Making an item 50% transparent:
     * var circle = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35,
     *     fillColor: 'red'
     * });
     *
     * var circle2 = new Path.Circle({
     *     center: new Point(120, 50),
     *     radius: 35,
     *     fillColor: 'blue',
     *     strokeColor: 'green',
     *     strokeWidth: 10
     * });
     *
     * // Make circle2 50% transparent:
     * circle2.opacity = 0.5;
     */

    // TODO: Implement guides
    /**
     * Specifies whether the item functions as a guide. When set to `true`, the
     * item will be drawn at the end as a guide.
     *
     * @name Item#guide
     * @type Boolean
     * @default true
     * @ignore
     */

    getSelection: function() {
        return this._selection;
    },

    setSelection: function(selection) {
        if (selection !== this._selection) {
            this._selection = selection;
            var project = this._project;
            if (project) {
                project._updateSelection(this);
                this._changed(/*#=*/Change.ATTRIBUTE);
            }
        }
    },

    changeSelection: function(flag, selected) {
        var selection = this._selection;
        this.setSelection(selected ? selection | flag : selection & ~flag);
    },

    /**
     * Specifies whether the item is selected. This will also return `true` for
     * {@link Group} items if they are partially selected, e.g. groups
     * containing selected or partially selected paths.
     *
     * Paper.js draws the visual outlines of selected items on top of your
     * project. This can be useful for debugging, as it allows you to see the
     * construction of paths, position of path curves, individual segment points
     * and bounding boxes of symbol and raster items.
     *
     * @bean
     * @type Boolean
     * @default false
     * @see Project#selectedItems
     * @see Segment#selected
     * @see Curve#selected
     * @see Point#selected
     *
     * @example {@paperscript}
     * // Selecting an item:
     * var path = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });
     * path.selected = true; // Select the path
     */
    isSelected: function() {
        if (this._selectChildren) {
            var children = this._children;
            for (var i = 0, l = children.length; i < l; i++)
                if (children[i].isSelected())
                    return true;
        }
        return !!(this._selection & /*#=*/ItemSelection.ITEM);
    },

    setSelected: function(selected) {
        if (this._selectChildren) {
            var children = this._children;
            for (var i = 0, l = children.length; i < l; i++)
                children[i].setSelected(selected);
        }
        this.changeSelection(/*#=*/ItemSelection.ITEM, selected);
    },

    isFullySelected: function() {
        var children = this._children,
            selected = !!(this._selection & /*#=*/ItemSelection.ITEM);
        if (children && selected) {
            for (var i = 0, l = children.length; i < l; i++)
                if (!children[i].isFullySelected())
                    return false;
            return true;
        }
        // If there are no children, this is the same as #selected
        return selected;
    },

    setFullySelected: function(selected) {
        var children = this._children;
        if (children) {
            for (var i = 0, l = children.length; i < l; i++)
                children[i].setFullySelected(selected);
        }
        this.changeSelection(/*#=*/ItemSelection.ITEM, selected);
    },

  

    // TODO: get/setIsolated (print specific feature)
    // TODO: get/setKnockout (print specific feature)
    // TODO: get/setAlphaIsShape

    /**
     * A plain javascript object which can be used to store
     * arbitrary data on the item.
     *
     * @bean
     * @type Object
     *
     * @example
     * var path = new Path();
     * path.data.remember = 'milk';
     *
     * @example
     * var path = new Path();
     * path.data.malcolm = new Point(20, 30);
     * console.log(path.data.malcolm.x); // 20
     *
     * @example
     * var path = new Path();
     * path.data = {
     *     home: 'Omicron Theta',
     *     found: 2338,
     *     pets: ['Spot']
     * };
     * console.log(path.data.pets.length); // 1
     *
     * @example
     * var path = new Path({
     *     data: {
     *         home: 'Omicron Theta',
     *         found: 2338,
     *         pets: ['Spot']
     *     }
     * });
     * console.log(path.data.pets.length); // 1
     */
    getData: function() {
        if (!this._data)
            this._data = {};
        return this._data;
    },

    setData: function(data) {
        this._data = data;
    },

    /**
     * {@grouptitle Position and Bounding Boxes}
     *
     * The item's position within the parent item's coordinate system. By
     * default, this is the {@link Rectangle#center} of the item's
     * {@link #bounds} rectangle.
     *
     * @bean
     * @type Point
     *
     * @example {@paperscript}
     * // Changing the position of a path:
     *
     * // Create a circle at position { x: 10, y: 10 }
     * var circle = new Path.Circle({
     *     center: new Point(10, 10),
     *     radius: 10,
     *     fillColor: 'red'
     * });
     *
     * // Move the circle to { x: 20, y: 20 }
     * circle.position = new Point(20, 20);
     *
     * // Move the circle 100 points to the right and 50 points down
     * circle.position += new Point(100, 50);
     *
     * @example {@paperscript split=true height=100}
     * // Changing the x coordinate of an item's position:
     *
     * // Create a circle at position { x: 20, y: 20 }
     * var circle = new Path.Circle({
     *     center: new Point(20, 20),
     *     radius: 10,
     *     fillColor: 'red'
     * });
     *
     * // Move the circle 100 points to the right
     * circle.position.x += 100;
     */
    getPosition: function(_dontLink) {
        // Cache position value.
        // Pass true for _dontLink in getCenter(), so receive back a normal point
        var position = this._position,
            ctor = _dontLink ? Point : LinkedPoint;
        // Do not cache LinkedPoints directly, since we would not be able to
        // use them to calculate the difference in #setPosition, as when it is
        // modified, it would hold new values already and only then cause the
        // calling of #setPosition.
        if (!position) {
            // If an pivot point is provided, use it to determine position
            // based on the matrix. Otherwise use the center of the bounds.
            var pivot = this._pivot;
            position = this._position = pivot
                    ? this._matrix._transformPoint(pivot)
                    : this.getBounds().getCenter(true);
        }
        return new ctor(position.x, position.y, this, 'setPosition');
    },

    setPosition: function(/* point */) {
        // Calculate the distance to the current position, by which to
        // translate the item. Pass true for _dontLink, as we do not need a
        // LinkedPoint to simply calculate this distance.
        this.translate(Point.read(arguments).subtract(this.getPosition(true)));
    },

    /**
     * The item's pivot point specified in the item coordinate system, defining
     * the point around which all transformations are hinging. This is also the
     * reference point for {@link #position}. By default, it is set to `null`,
     * meaning the {@link Rectangle#center} of the item's {@link #bounds}
     * rectangle is used as pivot.
     *
     * @bean
     * @type Point
     * @default null
     */
    getPivot: function() {
        var pivot = this._pivot;
        return pivot
                ? new LinkedPoint(pivot.x, pivot.y, this, 'setPivot')
                : null;
    },

    setPivot: function(/* point */) {
        // Clone existing points since we're caching internally.
        this._pivot = Point.read(arguments, 0, { clone: true, readNull: true });
        // No need for _changed() since the only thing this affects is _position
        this._position = undefined;
    }
}, Base.each({ // Produce getters for bounds properties:
        getStrokeBounds: { stroke: true },
        getHandleBounds: { handle: true },
        getInternalBounds: { internal: true }
    },
    function(options, key) {
        this[key] = function(matrix) {
            return this.getBounds(matrix, options);
        };
    },
/** @lends Item# */{
    // Enforce creation of beans, as bean getters have hidden parameters.
    // See _matrix parameter above.
    beans: true,

    getBounds: function(matrix, options) {
        var hasMatrix = options || matrix instanceof Matrix,
            opts = Base.set({}, hasMatrix ? options : matrix,
                    this._boundsOptions);
        // We can only cache the bounds if the path uses stroke-scaling, or if
        // no stroke is involved in the calculation of the bounds.
        // When strokeScaling is false, the bounds are affected by the zoom
        // level of the view, hence we can't cache.
        // TODO: Look more into handling of stroke-scaling, e.g. on groups with
        // some children that have strokeScaling, as well as SymbolItem with
        // SymbolDefinition that have strokeScaling!
        // TODO: Once that is resolved, we should be able to turn off
        // opts.stroke if a resolved item definition does not have a stroke,
        // allowing the code to share caches between #strokeBounds and #bounds.
        if (!opts.stroke || this.getStrokeScaling())
            opts.cacheItem = this;
        // If we're caching bounds, pass on this item as cacheItem, so
        // the children can setup _boundsCache structures for it.
        var bounds = this._getCachedBounds(hasMatrix && matrix, opts);
        // If we're returning '#bounds', create a LinkedRectangle that uses
        // the setBounds() setter to update the Item whenever the bounds are
        // changed:
        return !arguments.length
                ? new LinkedRectangle(bounds.x, bounds.y, bounds.width,
                        bounds.height, this, 'setBounds')
                : bounds;
    },

    setBounds: function(/* rect */) {
        var rect = Rectangle.read(arguments),
            bounds = this.getBounds(),
            _matrix = this._matrix,
            matrix = new Matrix(),
            center = rect.getCenter();
        // Read this from bottom to top:
        // Translate to new center:
        matrix.translate(center);
        // Scale to new Size, if size changes and avoid divisions by 0:
        if (rect.width != bounds.width || rect.height != bounds.height) {
            // If a previous transformation resulted in a non-invertible matrix,
            // Restore to the last revertible matrix stored in _backup, and get
            // the bounds again. That way, we can prevent collapsing to 0-size.
            if (!_matrix.isInvertible()) {
                _matrix.set(_matrix._backup
                        || new Matrix().translate(_matrix.getTranslation()));
                bounds = this.getBounds();
            }
            matrix.scale(
                    bounds.width !== 0 ? rect.width / bounds.width : 0,
                    bounds.height !== 0 ? rect.height / bounds.height : 0);
        }
        // Translate to bounds center:
        center = bounds.getCenter();
        matrix.translate(-center.x, -center.y);
        // Now execute the transformation
        this.transform(matrix);
    },

    /**
     * Protected method used in all the bounds getters. It loops through all the
     * children, gets their bounds and finds the bounds around all of them.
     * Subclasses override it to define calculations for the various required
     * bounding types.
     */
    _getBounds: function(matrix, options) {
        // NOTE: We cannot cache these results here, since we do not get
        // _changed() notifications here for changing geometry in children.
        // But cacheName is used in sub-classes such as SymbolItem and Raster.
        var children = this._children;
        // TODO: What to return if nothing is defined, e.g. empty Groups?
        // Scriptographer behaves weirdly then too.
        if (!children || !children.length)
            return new Rectangle();
        // Call _updateBoundsCache() even when the group only holds empty /
        // invisible items), so future changes in these items will cause right
        // handling of _boundsCache.
        Item._updateBoundsCache(this, options.cacheItem);
        return Item._getBounds(children, matrix, options);
    },

    /**
     * Private method that deals with the calling of _getBounds, recursive
     * matrix concatenation and handles all the complicated caching mechanisms.
     */
    _getCachedBounds: function(matrix, options) {
        // See if we can cache these bounds. We only cache the bounds
        // transformed with the internally stored _matrix, (the default if no
        // matrix is passed).
        matrix = matrix && matrix._orNullIfIdentity();
        // Do not transform by the internal matrix for internal, untransformed
        // bounds.
        var internal = options.internal,
            cacheItem = options.cacheItem,
            _matrix = internal ? null : this._matrix._orNullIfIdentity(),
            // Create a key for caching, reflecting all bounds options.
            cacheKey = cacheItem && (!matrix || matrix.equals(_matrix)) && [
                options.stroke ? 1 : 0,
                options.handle ? 1 : 0,
                internal ? 1 : 0
            ].join('');
        // NOTE: This needs to happen before returning cached values, since even
        // then, _boundsCache needs to be kept up-to-date.
        Item._updateBoundsCache(this._parent || this._symbol, cacheItem);
        if (cacheKey && this._bounds && cacheKey in this._bounds)
            return this._bounds[cacheKey].rect.clone();
        var bounds = this._getBounds(matrix || _matrix, options);
        // If we can cache the result, update the _bounds cache structure
        // before returning
        if (cacheKey) {
            if (!this._bounds)
                this._bounds = {};
            var cached = this._bounds[cacheKey] = {
                rect: bounds.clone(),
                // Mark as internal, so Item#transform() won't transform it
                internal: options.internal
            };
        }
        return bounds;
    },

    /**
     * Returns to correct matrix to use to transform stroke related geometries
     * when calculating bounds: the item's matrix if {@link #strokeScaling} is
     * `true`, otherwise the parent's inverted view matrix. The returned matrix
     * is always shiftless, meaning its translation vector is reset to zero.
     */
    _getStrokeMatrix: function(matrix, options) {
        var parent = this.getStrokeScaling() ? null
                : options && options.internal ? this
                    : this._parent || this._symbol && this._symbol._item,
            mx = parent ? parent.getViewMatrix().invert() : matrix;
        return mx && mx._shiftless();
    },

    statics: /** @lends Item */{
        /**
         * Set up a boundsCache structure that keeps track of items that keep
         * cached bounds that depend on this item. We store this in the parent,
         * for multiple reasons:
         * The parent receives CHILDREN change notifications for when its
         * children are added or removed and can thus clear the cache, and we
         * save a lot of memory, e.g. when grouping 100 items and asking the
         * group for its bounds. If stored on the children, we would have 100
         * times the same structure.
         */
        _updateBoundsCache: function(parent, item) {
            if (parent && item) {
                // Set-up the parent's boundsCache structure if it does not
                // exist yet and add the item to it.
                var id = item._id,
                    ref = parent._boundsCache = parent._boundsCache || {
                        // Use a hash-table for ids and an array for the list,
                        // so we can keep track of items that were added already
                        ids: {},
                        list: []
                    };
                if (!ref.ids[id]) {
                    ref.list.push(item);
                    ref.ids[id] = item;
                }
            }
        },

        /**
         * Clears cached bounds of all items that the children of this item are
         * contributing to. See _updateBoundsCache() for an explanation why this
         * information is stored on parents, not the children themselves.
         */
        _clearBoundsCache: function(item) {
            // This is defined as a static method so Symbol can used it too.
            // Clear the position as well, since it's depending on bounds.
            var cache = item._boundsCache;
            if (cache) {
                // Erase cache before looping, to prevent circular recursion.
                item._bounds = item._position = item._boundsCache = undefined;
                for (var i = 0, list = cache.list, l = list.length; i < l; i++){
                    var other = list[i];
                    if (other !== item) {
                        other._bounds = other._position = undefined;
                        // We need to recursively call _clearBoundsCache, as
                        // when the cache for the other item's children is not
                        // valid anymore, that propagates up the scene graph.
                        if (other._boundsCache)
                            Item._clearBoundsCache(other);
                    }
                }
            }
        },

        /**
         * Gets the combined bounds of all specified items.
         */
        _getBounds: function(items, matrix, options) {
            var x1 = Infinity,
                x2 = -x1,
                y1 = x1,
                y2 = x2;
            options = options || {};
            for (var i = 0, l = items.length; i < l; i++) {
                var item = items[i];
                if (item._visible && !item.isEmpty()) {
                    var rect = item._getCachedBounds(
                        matrix && matrix.appended(item._matrix), options);
                    x1 = Math.min(rect.x, x1);
                    y1 = Math.min(rect.y, y1);
                    x2 = Math.max(rect.x + rect.width, x2);
                    y2 = Math.max(rect.y + rect.height, y2);
                }
            }
            return isFinite(x1)
                    ? new Rectangle(x1, y1, x2 - x1, y2 - y1)
                    : new Rectangle();
        }
    }

    /**
     * The bounding rectangle of the item excluding stroke width.
     *
     * @name Item#bounds
     * @type Rectangle
     */

    /**
     * The bounding rectangle of the item including stroke width.
     *
     * @name Item#strokeBounds
     * @type Rectangle
     */

    /**
     * The bounding rectangle of the item including handles.
     *
     * @name Item#handleBounds
     * @type Rectangle
     */

    /**
     * The rough bounding rectangle of the item that is sure to include all of
     * the drawing, including stroke width.
     *
     * @name Item#roughBounds
     * @type Rectangle
     * @ignore
     */
}), /** @lends Item# */{
    // Enforce creation of beans, as bean getters have hidden parameters.
    // See #getGlobalMatrix() below.
    beans: true,

    _decompose: function() {
        return this._decomposed || (this._decomposed = this._matrix.decompose());
    },

    /**
     * The current rotation angle of the item, as described by its
     * {@link #matrix}.
     *
     * @bean
     * @type Number
     */
    getRotation: function() {
        var decomposed = this._decompose();
        return decomposed && decomposed.rotation;
    },

    setRotation: function(rotation) {
        var current = this.getRotation();
        if (current != null && rotation != null) {
            this.rotate(rotation - current);
        }
    },

    /**
     * The current scale factor of the item, as described by its
     * {@link #matrix}.
     *
     * @bean
     * @type Point
     */
    getScaling: function() {
        var decomposed = this._decompose(),
            scaling = decomposed && decomposed.scaling;
        return scaling
                ? new LinkedPoint(scaling.x, scaling.y, this, 'setScaling')
                : undefined;
    },

    setScaling: function(/* scaling */) {
        var current = this.getScaling(),
            // Clone existing points since we're caching internally.
            scaling = Point.read(arguments, 0, { clone: true, readNull: true });
        if (current && scaling) {
            this.scale(scaling.x / current.x, scaling.y / current.y);
        }
    },

    /**
     * The item's transformation matrix, defining position and dimensions in
     * relation to its parent item in which it is contained.
     *
     * @bean
     * @type Matrix
     */
    getMatrix: function() {
        return this._matrix;
    },

    setMatrix: function() {
        // Use Matrix#initialize to easily copy over values.
        // NOTE: calling initialize() also calls #_changed() for us, through its
        // call to #set() / #reset(), and this also handles _applyMatrix for us.
        var matrix = this._matrix;
        matrix.initialize.apply(matrix, arguments);
    },

    /**
     * The item's global transformation matrix in relation to the global project
     * coordinate space. Note that the view's transformations resulting from
     * zooming and panning are not factored in.
     *
     * @bean
     * @type Matrix
     */
    getGlobalMatrix: function(_dontClone) {
        var matrix = this._globalMatrix,
            updateVersion = this._project._updateVersion;
        // If #_globalMatrix is out of sync, recalculate it now.
        if (matrix && matrix._updateVersion !== updateVersion)
            matrix = null;
        if (!matrix) {
            matrix = this._globalMatrix = this._matrix.clone();
            var parent = this._parent;
            if (parent)
                matrix.prepend(parent.getGlobalMatrix(true));
            matrix._updateVersion = updateVersion;
        }
        return _dontClone ? matrix : matrix.clone();
    },

    /**
     * The item's global matrix in relation to the view coordinate space. This
     * means that the view's transformations resulting from zooming and panning
     * are factored in.
     *
     * @bean
     * @type Matrix
     */
    getViewMatrix: function() {
        return this.getGlobalMatrix().prepend(this.getView()._matrix);
    },

    /**
     * Controls whether the transformations applied to the item (e.g. through
     * {@link #transform(matrix)}, {@link #rotate(angle)},
     * {@link #scale(scale)}, etc.) are stored in its {@link #matrix} property,
     * or whether they are directly applied to its contents or children (passed
     * on to the segments in {@link Path} items, the children of {@link Group}
     * items, etc.).
     *
     * @bean
     * @type Boolean
     * @default true
     */
    getApplyMatrix: function() {
        return this._applyMatrix;
    },

    setApplyMatrix: function(apply) {
        // Tell #transform() to apply the internal matrix if _applyMatrix
        // can be set to true.
        if (this._applyMatrix = this._canApplyMatrix && !!apply)
            this.transform(null, true);
    },

    /**
     * @bean
     * @deprecated use {@link #applyMatrix} instead.
     */
    getTransformContent: '#getApplyMatrix',
    setTransformContent: '#setApplyMatrix',
}, /** @lends Item# */{
    /**
     * {@grouptitle Project Hierarchy}
     * The project that this item belongs to.
     *
     * @type Project
     * @bean
     */
    getProject: function() {
        return this._project;
    },

    _setProject: function(project, installEvents) {
        if (this._project !== project) {
            // Uninstall events before switching project, then install them
            // again.
            // NOTE: _installEvents handles all children too!
            if (this._project)
                this._installEvents(false);
            this._project = project;
            var children = this._children;
            for (var i = 0, l = children && children.length; i < l; i++)
                children[i]._setProject(project);
            // We need to call _installEvents(true) again, but merge it with
            // handling of installEvents argument below.
            installEvents = true;
        }
        if (installEvents)
            this._installEvents(true);
    },

    /**
     * The view that this item belongs to.
     * @type View
     * @bean
     */
    getView: function() {
        return this._project._view;
    },

    /**
     * Overrides Emitter#_installEvents to also call _installEvents on all
     * children.
     */
    _installEvents: function _installEvents(install) {
        _installEvents.base.call(this, install);
        var children = this._children;
        for (var i = 0, l = children && children.length; i < l; i++)
            children[i]._installEvents(install);
    },

    /**
     * The layer that this item is contained within.
     *
     * @type Layer
     * @bean
     */
    getLayer: function() {
        var parent = this;
        while (parent = parent._parent) {
            if (parent instanceof Layer)
                return parent;
        }
        return null;
    },

    /**
     * The item that this item is contained within.
     *
     * @type Item
     * @bean
     *
     * @example
     * var path = new Path();
     *
     * // New items are placed in the active layer:
     * console.log(path.parent == project.activeLayer); // true
     *
     * var group = new Group();
     * group.addChild(path);
     *
     * // Now the parent of the path has become the group:
     * console.log(path.parent == group); // true
     *
     * @example // Setting the parent of the item to another item
     * var path = new Path();
     *
     * // New items are placed in the active layer:
     * console.log(path.parent == project.activeLayer); // true
     *
     * var group = new Group();
     * group.parent = path;
     *
     * // Now the parent of the path has become the group:
     * console.log(path.parent == group); // true
     *
     * // The path is now contained in the children list of group:
     * console.log(group.children[0] == path); // true
     *
     * @example // Setting the parent of an item in the constructor
     * var group = new Group();
     *
     * var path = new Path({
     *     parent: group
     * });
     *
     * // The parent of the path is the group:
     * console.log(path.parent == group); // true
     *
     * // The path is contained in the children list of group:
     * console.log(group.children[0] == path); // true
     */
    getParent: function() {
        return this._parent;
    },

    setParent: function(item) {
        return item.addChild(this);
    },

    /**
     * Private helper to return the owner, either the parent, or the project
     * for top-level layers. See Layer#_getOwner()
     */
    _getOwner: '#getParent',

    /**
     * The children items contained within this item. Items that define a
     * {@link #name} can also be accessed by name.
     *
     * <b>Please note:</b> The children array should not be modified directly
     * using array functions. To remove single items from the children list, use
     * {@link Item#remove()}, to remove all items from the children list, use
     * {@link Item#removeChildren()}. To add items to the children list, use
     * {@link Item#addChild(item)} or {@link Item#insertChild(index,item)}.
     *
     * @type Item[]
     * @bean
     *
     * @example {@paperscript}
     * // Accessing items in the children array:
     * var path = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });
     *
     * // Create a group and move the path into it:
     * var group = new Group();
     * group.addChild(path);
     *
     * // Access the path through the group's children array:
     * group.children[0].fillColor = 'red';
     *
     * @example {@paperscript}
     * // Accessing children by name:
     * var path = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });
     * // Set the name of the path:
     * path.name = 'example';
     *
     * // Create a group and move the path into it:
     * var group = new Group();
     * group.addChild(path);
     *
     * // The path can be accessed by name:
     * group.children['example'].fillColor = 'orange';
     *
     * @example {@paperscript}
     * // Passing an array of items to item.children:
     * var path = new Path.Circle({
     *     center: [80, 50],
     *     radius: 35
     * });
     *
     * var group = new Group();
     * group.children = [path];
     *
     * // The path is the first child of the group:
     * group.firstChild.fillColor = 'green';
     */
    getChildren: function() {
        return this._children;
    },

    setChildren: function(items) {
        this.removeChildren();
        this.addChildren(items);
    },

    /**
     * The first item contained within this item. This is a shortcut for
     * accessing `item.children[0]`.
     *
     * @type Item
     * @bean
     */
    getFirstChild: function() {
        return this._children && this._children[0] || null;
    },

    /**
     * The last item contained within this item.This is a shortcut for
     * accessing `item.children[item.children.length - 1]`.
     *
     * @type Item
     * @bean
     */
    getLastChild: function() {
        return this._children && this._children[this._children.length - 1]
                || null;
    },

    /**
     * The next item on the same level as this item.
     *
     * @type Item
     * @bean
     */
    getNextSibling: function() {
        var owner = this._getOwner();
        return owner && owner._children[this._index + 1] || null;
    },

    /**
     * The previous item on the same level as this item.
     *
     * @type Item
     * @bean
     */
    getPreviousSibling: function() {
        var owner = this._getOwner();
        return owner && owner._children[this._index - 1] || null;
    },

    /**
     * The index of this item within the list of its parent's children.
     *
     * @type Number
     * @bean
     */
    getIndex: function() {
        return this._index;
    },

    equals: function(item) {
        // NOTE: We do not compare name and selected state.
        // TODO: Consider not comparing locked and visible also?
        return item === this || item && this._class === item._class
                //&& this._style.equals(item._style)
                && this._matrix.equals(item._matrix)
                && this._locked === item._locked
                && this._visible === item._visible
                && this._blendMode === item._blendMode
                && this._opacity === item._opacity
                && this._clipMask === item._clipMask
                && this._guide === item._guide
                && this._equals(item)
                || false;
    },

    /**
     * A private helper for #equals(), to be overridden in sub-classes. When it
     * is called, item is always defined, of the same class as `this` and has
     * equal general state attributes such as matrix, style, opacity, etc.
     */
    _equals: function(item) {
        return Base.equals(this._children, item._children);
    },

    /**
     * Clones the item within the same project and places the copy above the
     * item.
     *
     * @option [insert=true] specifies whether the copy should be
     *     inserted into the scene graph. When set to `true`, it is inserted
     *     above the original
     * @option [deep=true] specifies whether the item's children should also be
     *     cloned
     *
     * @param {Object} [options={ insert: true, deep: true }]
     *
     * @return {Item} the newly cloned item
     *
     * @example {@paperscript}
     * // Cloning items:
     * var circle = new Path.Circle({
     *     center: [50, 50],
     *     radius: 10,
     *     fillColor: 'red'
     * });
     *
     * // Make 20 copies of the circle:
     * for (var i = 0; i < 20; i++) {
     *     var copy = circle.clone();
     *
     *     // Distribute the copies horizontally, so we can see them:
     *     copy.position.x += i * copy.bounds.width;
     * }
     */
    clone: function(options) {
        var copy = new this.constructor(Item.NO_INSERT),
            children = this._children,
            // Both `insert` and `deep` are true by default:
            insert = Base.pick(options ? options.insert : undefined,
                    // Also support boolean parameter for insert, default: true.
                    options === undefined || options === true),
            deep = Base.pick(options ? options.deep : undefined, true);
        // On items with children, for performance reasons due to the way that
        // styles are currently "flattened" into existing children, we need to
        // clone attributes first, then content.
        // For all other items, it's the other way around, since applying
        // attributes might have an impact on their content.
        if (children)
            copy.copyAttributes(this);
        // Only copy content if we don't have children or if we're ask to create
        // a deep clone, which is the default.
        if (!children || deep)
            copy.copyContent(this);
        if (!children)
            copy.copyAttributes(this);
        if (insert)
            copy.insertAbove(this);
        // Make sure we're not overriding the original name in the same parent
        var name = this._name,
            parent = this._parent;
        if (name && parent) {
            var children = parent._children,
                orig = name,
                i = 1;
            while (children[name])
                name = orig + ' ' + (i++);
            if (name !== orig)
                copy.setName(name);
        }
        return copy;
    },

    /**
     * Copies the content of the specified item over to this item.
     *
     * @param {Item} source the item to copy the content from
     */
    copyContent: function(source) {
        var children = source._children;
        // Clone all children and add them to the copy. tell #addChild we're
        // cloning, as needed by CompoundPath#insertChild().
        for (var i = 0, l = children && children.length; i < l; i++) {
            this.addChild(children[i].clone(false), true);
        }
    },

    /**
     * Copies all attributes of the specified item over to this item. This
     * includes its style, visibility, matrix, pivot, blend-mode, opacity,
     * selection state, data, name, etc.
     *
     * @param {Item} source the item to copy the attributes from
     * @param {Boolean} excludeMatrix whether to exclude the transformation
     * matrix when copying all attributes
     */
    copyAttributes: function(source, excludeMatrix) {
        // Copy over style
        //this.setStyle(source._style);
        // Only copy over these fields if they are actually defined in 'source',
        // meaning the default value has been overwritten (default is on
        // prototype).
        var keys = ['_locked', '_visible', '_blendMode', '_opacity',
                '_clipMask', '_guide'];
        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            if (source.hasOwnProperty(key))
                this[key] = source[key];
        }
        // Use Matrix#initialize to easily copy over values.
        if (!excludeMatrix)
            this._matrix.set(source._matrix);
        // We can't just set _applyMatrix as many item types won't allow it,
        // e.g. creating a Shape in Path#toShape().
        // Using the setter instead takes care of it.
        // NOTE: This will also bake in the matrix that we just initialized,
        // in case #applyMatrix is true.
        this.setApplyMatrix(source._applyMatrix);
        this.setPivot(source._pivot);
        // Copy over the selection state, use setSelection so the item
        // is also added to Project#_selectionItems if it is selected.
        this.setSelection(source._selection);
        // Copy over data and name as well.
        var data = source._data,
            name = source._name;
        this._data = data ? Base.clone(data) : null;
        if (name)
            this.setName(name);
    },

 
    /**
     * {@grouptitle Geometric Tests}
     *
     * Checks whether the item's geometry contains the given point.
     *
     * @example {@paperscript} // Click within and outside the star below
     * // Create a star shaped path:
     * var path = new Path.Star({
     *     center: [50, 50],
     *     points: 12,
     *     radius1: 20,
     *     radius2: 40,
     *     fillColor: 'black'
     * });
     *
     * // Whenever the user presses the mouse:
     * function onMouseDown(event) {
     *     // If the position of the mouse is within the path,
     *     // set its fill color to red, otherwise set it to
     *     // black:
     *     if (path.contains(event.point)) {
     *         path.fillColor = 'red';
     *     } else {
     *         path.fillColor = 'black';
     *     }
     * }
     *
     * @param {Point} point the point to check for
     */
    contains: function(/* point */) {
        // See CompoundPath#_contains() for the reason for !!
        return !!this._contains(
                this._matrix._inverseTransform(Point.read(arguments)));
    },

    _contains: function(point) {
        var children = this._children;
        if (children) {
            for (var i = children.length - 1; i >= 0; i--) {
                if (children[i].contains(point))
                    return true;
            }
            return false;
        }
        // We only implement it here for items with rectangular content,
        // for anything else we need to override #contains()
        return point.isInside(this.getInternalBounds());
    },

    // DOCS:
    // TEST:
    /**
     * @param {Rectangle} rect the rectangle to check against
     * @return {Boolean}
     */
    isInside: function(/* rect */) {
        return Rectangle.read(arguments).contains(this.getBounds());
    },

    // Internal helper function, used at the moment for intersects check only.
    // TODO: Move #getIntersections() to Item, make it handle all type of items
    // through _asPathItem(), and support Group items as well, taking nested
    // matrices into account properly!
    _asPathItem: function() {
        // Creates a temporary rectangular path item with this item's bounds.
        return new Path.Rectangle({
            rectangle: this.getInternalBounds(),
            matrix: this._matrix,
            insert: false,
        });
    },

    // DOCS:
    // TEST:
    /**
     * @param {Item} item the item to check against
     * @return {Boolean}
     */
    intersects: function(item, _matrix) {
        if (!(item instanceof Item))
            return false;
        // Tell getIntersections() to return as soon as some intersections are
        // found, because all we care for here is there are some or none:
        return this._asPathItem().getIntersections(item._asPathItem(), null,
                _matrix, true).length > 0;
    }
},
  /** @lends Item# */{
    
    addChild: function(item) {
        return this.insertChild(undefined, item);
    },

    /**
     * Inserts the specified item as a child of this item at the specified index
     * in its {@link #children} list. You can use this function for groups,
     * compound paths and layers.
     *
     * @param {Number} index the index at which to insert the item
     * @param {Item} item the item to be inserted as a child
     * @return {Item} the inserted item, or `null` if inserting was not possible
     */
    insertChild: function(index, item) {
        var res = item ? this.insertChildren(index, [item]) : null;
        return res && res[0];
    },

    /**
     * Adds the specified items as children of this item at the end of the its
     * children list. You can use this function for groups, compound paths and
     * layers.
     *
     * @param {Item[]} items the items to be added as children
     * @return {Item[]} the added items, or `null` if adding was not possible
     */
    addChildren: function(items) {
        return this.insertChildren(this._children.length, items);
    },

    /**
     * Inserts the specified items as children of this item at the specified
     * index in its {@link #children} list. You can use this function for
     * groups, compound paths and layers.
     *
     * @param {Number} index
     * @param {Item[]} items the items to be appended as children
     * @return {Item[]} the inserted items, or `null` if inserted was not
     *     possible
     */
    insertChildren: function(index, items) {
        var children = this._children;
        if (children && items && items.length > 0) {
            // We need to clone items because it may be an Item#children array.
            // Also, we're removing elements if they don't match _type.
            // Use Base.slice() because items can be an arguments object.
            items = Base.slice(items);
            // Remove the items from their parents first, since they might be
            // inserted into their own parents, affecting indices.
            // Use the loop also to filter invalid items.
            for (var i = items.length - 1; i >= 0; i--) {
                var item = items[i];
                if (!item) {
                    items.splice(i, 1);
                } else {
                    // Notify parent of change. Don't notify item itself yet,
                    // as we're doing so when adding it to the new owner below.
                    item._remove(false, true);
                }
            }
            Base.splice(children, items, index, 0);
            var project = this._project,
                // See #_remove() for an explanation of this:
                notifySelf = project._changes;
            for (var i = 0, l = items.length; i < l; i++) {
                var item = items[i],
                    name = item._name;
                item._parent = this;
                item._setProject(project, true);
                // Set the name again to make sure all name lookup structures
                // are kept in sync.
                if (name)
                    item.setName(name);
                if (notifySelf)
                    this._changed(/*#=*/Change.INSERTION);
            }
            this._changed(/*#=*/Change.CHILDREN);
        } else {
            items = null;
        }
        return items;
    },

    // Internal alias, so both Project and Item can be used in #copyTo(), and
    // through _getOwner() in the various Item#insert*() methods.
    _insertItem: '#insertChild',

    /**
     * Private helper method used by {@link #insertAbove(item)} and
     * {@link #insertBelow(item)}, to insert this item in relation to a
     * specified other item.
     *
     * @param {Item} item the item in relation to which which it should be
     *     inserted
     * @param {Number} offset the offset at which the item should be inserted
     * @return {Item} the inserted item, or `null` if inserting was not possible
     */
    _insertAt: function(item, offset) {
        var res = this;
        if (res !== item) {
            var owner = item && item._getOwner();
            if (owner) {
                // Notify parent of change. Don't notify item itself yet,
                // as we're doing so when adding it to the new owner below.
                res._remove(false, true);
                owner._insertItem(item._index + offset, res);
            } else {
                res = null;
            }
        }
        return res;
    },

    /**
     * Inserts this item above the specified item.
     *
     * @param {Item} item the item above which it should be inserted
     * @return {Item} the inserted item, or `null` if inserting was not possible
     */
    insertAbove: function(item) {
        return this._insertAt(item, 1);
    },

    /**
     * Inserts this item below the specified item.
     *
     * @param {Item} item the item below which it should be inserted
     * @return {Item} the inserted item, or `null` if inserting was not possible
     */
    insertBelow: function(item) {
        return this._insertAt(item, 0);
    },

   
    /**
     * Inserts the specified item as a child of this item by appending it to
     * the list of children and moving it above all other children. You can
     * use this function for groups, compound paths and layers.
     *
     * @function
     * @param {Item} item the item to be appended as a child
     * @deprecated use {@link #addChild(item)} instead.
     */
    appendTop: '#addChild',

    /**
     * Inserts the specified item as a child of this item by appending it to
     * the list of children and moving it below all other children. You can
     * use this function for groups, compound paths and layers.
     *
     * @param {Item} item the item to be appended as a child
     * @deprecated use {@link #insertChild(index, item)} instead.
     */
    appendBottom: function(item) {
        return this.insertChild(0, item);
    },

    /**
     * Moves this item above the specified item.
     *
     * @function
     * @param {Item} item the item above which it should be moved
     * @return {Boolean} {@true if it was moved}
     * @deprecated use {@link #insertAbove(item)} instead.
     */
    moveAbove: '#insertAbove',

    /**
     * Moves the item below the specified item.
     *
     * @function
     * @param {Item} item the item below which it should be moved
     * @return {Boolean} {@true if it was moved}
     * @deprecated use {@link #insertBelow(item)} instead.
     */
    moveBelow: '#insertBelow',

    /**
     * When passed a project, copies the item to the project,
     * or duplicates it within the same project. When passed an item,
     * copies the item into the specified item.
     *
     * @param {Project|Layer|Group|CompoundPath} owner the item or project to
     * copy the item to
     * @return {Item} the new copy of the item
     */
    copyTo: function(owner) {
        // Pass false for insert, since we're inserting at a specific location.
        return owner._insertItem(undefined, this.clone(false));
    },

    /**
     * If this is a group, layer or compound-path with only one child-item,
     * the child-item is moved outside and the parent is erased. Otherwise, the
     * item itself is returned unmodified.
     *
     * @return {Item} the reduced item
     */
    reduce: function(options) {
        var children = this._children;
        if (children && children.length === 1) {
            var child = children[0].reduce(options);
            // Make sure the reduced item has the same parent as the original.
            if (this._parent) {
                child.insertAbove(this);
                this.remove();
            } else {
                child.remove();
            }
            return child;
        }
        return this;
    },

    /**
     * Removes the item from its parent's named children list.
     */
    _removeNamed: function() {
        var owner = this._getOwner();
        if (owner) {
            var children = owner._children,
                namedChildren = owner._namedChildren,
                name = this._name,
                namedArray = namedChildren[name],
                index = namedArray ? namedArray.indexOf(this) : -1;
            if (index !== -1) {
                // Remove the named reference
                if (children[name] == this)
                    delete children[name];
                // Remove this entry
                namedArray.splice(index, 1);
                // If there are any items left in the named array, set the first
                // of them to be children[this.name]
                if (namedArray.length) {
                    children[name] = namedArray[0];
                } else {
                    // Otherwise delete the empty array
                    delete namedChildren[name];
                }
            }
        }
    },

    /**
     * Removes the item from its parent's children list.
     */
    _remove: function(notifySelf, notifyParent) {
        var owner = this._getOwner(),
            project = this._project,
            index = this._index;
        if (owner) {
            // Handle index separately from owner: There are situations where
            // the item is already removed from its list through Base.splice()
            // and index set to undefined, but the owner is still set,
            // e.g. in #removeChildren():
            if (index != null) {
                // Only required for layers but not enough to merit an override.
                if (project._activeLayer === this)
                    project._activeLayer = this.getNextSibling()
                            || this.getPreviousSibling();
                Base.splice(owner._children, null, index, 1);
            }
            // Handle named children separately from index:
            if (this._name)
                this._removeNamed();
            this._installEvents(false);
            // Notify self of the insertion change. We only need this
            // notification if we're tracking changes for now.
            if (notifySelf && project._changes)
                this._changed(/*#=*/Change.INSERTION);
            // Notify owner of changed children (this can be the project too).
            if (notifyParent)
                owner._changed(/*#=*/Change.CHILDREN, this);
            this._parent = null;
            return true;
        }
        return false;
    },

    /**
     * Removes the item and all its children from the project. The item is not
     * destroyed and can be inserted again after removal.
     *
     * @return {Boolean} {@true if the item was removed}
     */
    remove: function() {
        // Notify self and parent of change:
        return this._remove(true, true);
    },

    /**
     * Replaces this item with the provided new item which will takes its place
     * in the project hierarchy instead.
     *
     * @return {Boolean} {@true if the item was replaced}
     */
    replaceWith: function(item) {
        var ok = item && item.insertBelow(this);
        if (ok)
            this.remove();
        return ok;
    },

    /**
     * Removes all of the item's {@link #children} (if any).
     *
     * @name Item#removeChildren
     * @alias Item#clear
     * @function
     * @return {Item[]} an array containing the removed items
     */
    /**
     * Removes the children from the specified `start` index to and excluding
     * the `end` index from the parent's {@link #children} array.
     *
     * @name Item#removeChildren
     * @function
     * @param {Number} start the beginning index, inclusive
     * @param {Number} [end=children.length] the ending index, exclusive
     * @return {Item[]} an array containing the removed items
     */
    removeChildren: function(start, end) {
        if (!this._children)
            return null;
        start = start || 0;
        end = Base.pick(end, this._children.length);
        // Use Base.splice(), which adjusts #_index for the items above, and
        // deletes it for the removed items. Calling #_remove() afterwards is
        // fine, since it only calls Base.splice() if #_index is set.
        var removed = Base.splice(this._children, null, start, end - start);
        for (var i = removed.length - 1; i >= 0; i--) {
            // Don't notify parent each time, notify it separately after.
            removed[i]._remove(true, false);
        }
        if (removed.length > 0)
            this._changed(/*#=*/Change.CHILDREN);
        return removed;
    },

    // DOCS Item#clear()
    clear: '#removeChildren',

    /**
     * Reverses the order of the item's children
     */
    reverseChildren: function() {
        if (this._children) {
            this._children.reverse();
            // Adjust indices
            for (var i = 0, l = this._children.length; i < l; i++)
                this._children[i]._index = i;
            this._changed(/*#=*/Change.CHILDREN);
        }
    },

    /**
     * {@grouptitle Tests}
     * Specifies whether the item has any content or not. The meaning of what
     * content is differs from type to type. For example, a {@link Group} with
     * no children, a {@link TextItem} with no text content and a {@link Path}
     * with no segments all are considered empty.
     *
     * @return Boolean
     */
    isEmpty: function() {
        var children = this._children;
        return !children || !children.length;
    },

    /**
     * Checks whether the item is editable.
     *
     * @return {Boolean} {@true when neither the item, nor its parents are
     * locked or hidden}
     * @ignore
     */
    // TODO: Item#isEditable is currently ignored in the documentation, as
    // locking an item currently has no effect
    isEditable: function() {
        var item = this;
        while (item) {
            if (!item._visible || item._locked)
                return false;
            item = item._parent;
        }
        return true;
    },

    /**
     * Checks whether the item is valid, i.e. it hasn't been removed.
     *
     * @return {Boolean} {@true if the item is valid}
     */
    // TODO: isValid / checkValid

 
    /**
     * Returns -1 if 'this' is above 'item', 1 if below, 0 if their order is not
     * defined in such a way, e.g. if one is a descendant of the other.
     */
    _getOrder: function(item) {
        // Private method that produces a list of anchestors, starting with the
        // root and ending with the actual element as the last entry.
        function getList(item) {
            var list = [];
            do {
                list.unshift(item);
            } while (item = item._parent);
            return list;
        }
        var list1 = getList(this),
            list2 = getList(item);
        for (var i = 0, l = Math.min(list1.length, list2.length); i < l; i++) {
            if (list1[i] != list2[i]) {
                // Found the position in the parents list where the two start
                // to differ. Look at who's above who.
                return list1[i]._index < list2[i]._index ? 1 : -1;
            }
        }
        return 0;
    },

    /**
     * {@grouptitle Hierarchy Tests}
     *
     * Checks if the item contains any children items.
     *
     * @return {Boolean} {@true it has one or more children}
     */
    hasChildren: function() {
        return this._children && this._children.length > 0;
    },

    /**
     * Checks whether the item and all its parents are inserted into scene graph
     * or not.
     *
     * @return {Boolean} {@true if the item is inserted into the scene graph}
     */
    isInserted: function() {
        return this._parent ? this._parent.isInserted() : false;
    },

    /**
     * Checks if this item is above the specified item in the stacking order
     * of the project.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if it is above the specified item}
     */
    isAbove: function(item) {
        return this._getOrder(item) === -1;
    },

    /**
     * Checks if the item is below the specified item in the stacking order of
     * the project.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if it is below the specified item}
     */
    isBelow: function(item) {
        return this._getOrder(item) === 1;
    },

    /**
     * Checks whether the specified item is the parent of the item.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if it is the parent of the item}
     */
    isParent: function(item) {
        return this._parent === item;
    },

    /**
     * Checks whether the specified item is a child of the item.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true it is a child of the item}
     */
    isChild: function(item) {
        return item && item._parent === this;
    },

    /**
     * Checks if the item is contained within the specified item.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if it is inside the specified item}
     */
    isDescendant: function(item) {
        var parent = this;
        while (parent = parent._parent) {
            if (parent === item)
                return true;
        }
        return false;
    },

    /**
     * Checks if the item is an ancestor of the specified item.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if the item is an ancestor of the specified
     * item}
     */
    isAncestor: function(item) {
        return item ? item.isDescendant(this) : false;
    },

    /**
     * Checks if the item is an a sibling of the specified item.
     *
     * @param {Item} item the item to check against
     * @return {Boolean} {@true if the item is aa sibling of the specified item}
     */
    isSibling: function(item) {
        return this._parent === item._parent;
    },

    /**
     * Checks whether the item is grouped with the specified item.
     *
     * @param {Item} item
     * @return {Boolean} {@true if the items are grouped together}
     */
    isGroupedWith: function(item) {
        var parent = this._parent;
        while (parent) {
            // Find group parents. Check for parent._parent, since don't want
            // top level layers, because they also inherit from Group
            if (parent._parent
                && /^(Group|Layer|CompoundPath)$/.test(parent._class)
                && item.isDescendant(parent))
                    return true;
            // Keep walking up otherwise
            parent = parent._parent;
        }
        return false;
    },

  
    /**
     * {@grouptitle Selection Style}
     *
     * The color the item is highlighted with when selected. If the item does
     * not specify its own color, the color defined by its layer is used instead.
     *
     * @name Item#selectedColor
     * @property
     * @type Color
     */
}, Base.each(['rotate', 'scale', 'shear', 'skew'], function(key) {
    var rotate = key === 'rotate';
    this[key] = function(/* value, center */) {
        var value = (rotate ? Base : Point).read(arguments),
            center = Point.read(arguments, 0, { readNull: true });
        return this.transform(new Matrix()[key](value,
                center || this.getPosition(true)));
    };
}, /** @lends Item# */{
    /**
     * {@grouptitle Transform Functions}
     *
     * Translates (moves) the item by the given offset views.
     *
     * @param {Point} delta the offset to translate the item by
     */
    translate: function(/* delta */) {
        var mx = new Matrix();
        return this.transform(mx.translate.apply(mx, arguments));
    },

    /**
     * Rotates the item by a given angle around the given center point.
     *
     * Angles are oriented clockwise and measured in degrees.
     *
     * @name Item#rotate
     * @function
     * @param {Number} angle the rotation angle
     * @param {Point} [center={@link Item#position}]
     * @see Matrix#rotate(angle[, center])
     *
     * @example {@paperscript}
     * // Rotating an item:
     *
     * // Create a rectangle shaped path with its top left
     * // point at {x: 80, y: 25} and a size of {width: 50, height: 50}:
     * var path = new Path.Rectangle(new Point(80, 25), new Size(50, 50));
     * path.fillColor = 'black';
     *
     * // Rotate the path by 30 degrees:
     * path.rotate(30);
     *
     * @example {@paperscript height=200}
     * // Rotating an item around a specific point:
     *
     * // Create a rectangle shaped path with its top left
     * // point at {x: 175, y: 50} and a size of {width: 100, height: 100}:
     * var topLeft = new Point(175, 50);
     * var size = new Size(100, 100);
     * var path = new Path.Rectangle(topLeft, size);
     * path.fillColor = 'black';
     *
     * // Draw a circle shaped path in the center of the view,
     * // to show the rotation point:
     * var circle = new Path.Circle({
     *     center: view.center,
     *     radius: 5,
     *     fillColor: 'white'
     * });
     *
     * // Each frame rotate the path 3 degrees around the center point
     * // of the view:
     * function onFrame(event) {
     *     path.rotate(3, view.center);
     * }
     */

    /**
     * Scales the item by the given value from its center point, or optionally
     * from a supplied point.
     *
     * @name Item#scale
     * @function
     * @param {Number} scale the scale factor
     * @param {Point} [center={@link Item#position}]
     *
     * @example {@paperscript}
     * // Scaling an item from its center point:
     *
     * // Create a circle shaped path at { x: 80, y: 50 }
     * // with a radius of 20:
     * var circle = new Path.Circle({
     *     center: [80, 50],
     *     radius: 20,
     *     fillColor: 'red'
     * });
     *
     * // Scale the path by 150% from its center point
     * circle.scale(1.5);
     *
     * @example {@paperscript}
     * // Scaling an item from a specific point:
     *
     * // Create a circle shaped path at { x: 80, y: 50 }
     * // with a radius of 20:
     * var circle = new Path.Circle({
     *     center: [80, 50],
     *     radius: 20,
     *     fillColor: 'red'
     * });
     *
     * // Scale the path 150% from its bottom left corner
     * circle.scale(1.5, circle.bounds.bottomLeft);
     */
    /**
     * Scales the item by the given values from its center point, or optionally
     * from a supplied point.
     *
     * @name Item#scale
     * @function
     * @param {Number} hor the horizontal scale factor
     * @param {Number} ver the vertical scale factor
     * @param {Point} [center={@link Item#position}]
     *
     * @example {@paperscript}
     * // Scaling an item horizontally by 300%:
     *
     * // Create a circle shaped path at { x: 100, y: 50 }
     * // with a radius of 20:
     * var circle = new Path.Circle({
     *     center: [100, 50],
     *     radius: 20,
     *     fillColor: 'red'
     * });
     *
     * // Scale the path horizontally by 300%
     * circle.scale(3, 1);
     */

    // TODO: Add test for item shearing, as it might be behaving oddly.
    /**
     * Shears the item by the given value from its center point, or optionally
     * by a supplied point.
     *
     * @name Item#shear
     * @function
     * @param {Point} shear the horziontal and vertical shear factors as a point
     * @param {Point} [center={@link Item#position}]
     * @see Matrix#shear(shear[, center])
     */
    /**
     * Shears the item by the given values from its center point, or optionally
     * by a supplied point.
     *
     * @name Item#shear
     * @function
     * @param {Number} hor the horizontal shear factor
     * @param {Number} ver the vertical shear factor
     * @param {Point} [center={@link Item#position}]
     * @see Matrix#shear(hor, ver[, center])
     */

    /**
     * Skews the item by the given angles from its center point, or optionally
     * by a supplied point.
     *
     * @name Item#skew
     * @function
     * @param {Point} skew the horziontal and vertical skew angles in degrees
     * @param {Point} [center={@link Item#position}]
     * @see Matrix#shear(skew[, center])
     */
    /**
     * Skews the item by the given angles from its center point, or optionally
     * by a supplied point.
     *
     * @name Item#skew
     * @function
     * @param {Number} hor the horizontal skew angle in degrees
     * @param {Number} ver the vertical sskew angle in degrees
     * @param {Point} [center={@link Item#position}]
     * @see Matrix#shear(hor, ver[, center])
     */

    /**
     * Transform the item.
     *
     * @param {Matrix} matrix the matrix by which the item shall be transformed
     */
    // TODO: Implement flags:
    // @param {String[]} flags array of any of the following: 'objects',
    //        'children', 'fill-gradients', 'fill-patterns', 'stroke-patterns',
    //        'lines'. Default: ['objects', 'children']
    transform: function(matrix, _applyMatrix, _applyRecursively,
            _setApplyMatrix) {
        // If no matrix is provided, or the matrix is the identity, we might
        // still have some work to do in case _applyMatrix is true
        if (matrix && matrix.isIdentity())
            matrix = null;
        var _matrix = this._matrix,
            applyMatrix = (_applyMatrix || this._applyMatrix)
                    // Don't apply _matrix if the result of concatenating with
                    // matrix would be identity.
                    && ((!_matrix.isIdentity() || matrix)
                        // Even if it's an identity matrix, we still need to
                        // recursively apply the matrix to children.
                        || _applyMatrix && _applyRecursively && this._children);
        // Bail out if there is nothing to do.
        if (!matrix && !applyMatrix)
            return this;
        // Simply prepend the internal matrix with the passed one:
        if (matrix) {
            // Keep a backup of the last valid state before the matrix becomes
            // non-invertible. This is then used again in setBounds to restore.
            if (!matrix.isInvertible() && _matrix.isInvertible())
                _matrix._backup = _matrix.getValues();
            _matrix.prepend(matrix);
        }
        // Call #_transformContent() now, if we need to directly apply the
        // internal _matrix transformations to the item's content.
        // Application is not possible on Raster, PointText, SymbolItem, since
        // the matrix is where the actual transformation state is stored.
        if (applyMatrix = applyMatrix && this._transformContent(_matrix,
                    _applyRecursively, _setApplyMatrix)) {
            // When the _matrix could be applied, we also need to transform
            // color styles (only gradients so far) and pivot point:
            var pivot = this._pivot
                //style = this._style,
                // pass true for _dontMerge so we don't recursively transform
                // styles on groups' children.
                //fillColor = style.getFillColor(true),
                //strokeColor = style.getStrokeColor(true);
            if (pivot)
                _matrix._transformPoint(pivot, pivot, true);
            if (fillColor)
                fillColor.transform(_matrix);
            if (strokeColor)
                strokeColor.transform(_matrix);
            // Reset the internal matrix to the identity transformation if it
            // was possible to apply it.
            _matrix.reset(true);
            // Set the internal _applyMatrix flag to true if we're told to do so
            if (_setApplyMatrix && this._canApplyMatrix)
                this._applyMatrix = true;
        }
        // Calling _changed will clear _bounds and _position, but depending
        // on matrix we can calculate and set them again, so preserve them.
        var bounds = this._bounds,
            position = this._position;
        // We always need to call _changed since we're caching bounds on all
        // items, including Group.
        this._changed(/*#=*/Change.GEOMETRY);
        // Detect matrices that contain only translations and scaling
        // and transform the cached _bounds and _position without having to
        // fully recalculate each time.
        var decomp = bounds && matrix && matrix.decompose();
        if (decomp && !decomp.shearing && decomp.rotation % 90 === 0) {
            // Transform the old bound by looping through all the cached bounds
            // in _bounds and transform each.
            for (var key in bounds) {
                var cache = bounds[key];
                // If these are internal bounds, only transform them if this
                // item applied its matrix.
                if (applyMatrix || !cache.internal) {
                    var rect = cache.rect;
                    matrix._transformBounds(rect, rect);
                }
            }
            // If we have cached bounds, update _position again as its
            // center. We need to take into account _boundsGetter here too, in
            // case another getter is assigned to it, e.g. 'getStrokeBounds'.
            var getter = this._boundsGetter,
                rect = bounds[getter && getter.getBounds || getter || 'getBounds'];
            if (rect)
                this._position = rect.getCenter(true);
            this._bounds = bounds;
        } else if (matrix && position) {
            // Transform position as well.
            this._position = matrix._transformPoint(position, position);
        }
        // Allow chaining here, since transform() is related to Matrix functions
        return this;
    },

    _transformContent: function(matrix, applyRecursively, setApplyMatrix) {
        var children = this._children;
        if (children) {
            for (var i = 0, l = children.length; i < l; i++)
                children[i].transform(matrix, true, applyRecursively,
                        setApplyMatrix);
            return true;
        }
    },


  
}));
