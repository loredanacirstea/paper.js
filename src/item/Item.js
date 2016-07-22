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

        // Filter out Item.NO_INSERT before _set(), for performance reasons.
        
        return hasProps;
    },

    _serialize: function(options, dictionary) {
        var props = {},
            that = this;

        function serialize(fields) {
            for (var key in fields) {
                // value is the default value, only serialize if the current
                // value is different from it.
                var value = that[key];
                // Style#leading is a special case, as its default value is
                // dependent on the fontSize. Handle this here separately.
                if (!Base.equals(value, key === 'leading'
                        ? fields.fontSize * 1.2 : fields[key])) {
                    props[key] = Base.serialize(value, options,
                            // Do not use compact mode for data
                            key !== 'data', dictionary);
                }
            }
        }

        // Serialize fields that this Item subclass defines first
        serialize(this._serializeFields);
        // Serialize style fields, but only if they differ from defaults.
        // Do not serialize styles on Groups and Layers, since they just unify
        // their children's own styles.

        // There is no compact form for Item serialization, we always keep the
        // class.
        return [ this._class, props ];
    },

 

}, Base.each(['locked', 'visible', 'blendMode', 'opacity', 'guide'],
    // Produce getter/setters for properties. We need setters because we want to
    // call _changed() if a property was modified.
    function(name) {
        var part = Base.capitalize(name),
            name = '_' + name;
        this['get' + part] = function() {
            return this[name];
        };
        this['set' + part] = function(value) {
            if (value != this[name]) {
                this[name] = value;
                // #locked does not change appearance, all others do:
                this._changed(name === '_locked'
                        ? /*#=*/ChangeFlag.ATTRIBUTE : /*#=*/Change.ATTRIBUTE);
            }
        };
    },
{}), Base.each({ // Produce getters for bounds properties:
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

}, /** @lends Item# */{

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
            copy.copyContent(this);
    
        return copy;
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
    /**
     * {@grouptitle Importing / Exporting JSON and SVG}
     *
     * Exports (serializes) the item with its content and child items to a JSON
     * data string.
     *
     * @name Item#exportJSON
     * @function
     *
     * @option [options.asString=true] {Boolean} whether the JSON is returned as
     *     a `Object` or a `String`
     * @option [options.precision=5] {Number} the amount of fractional digits in
     *     numbers used in JSON data
     *
     * @param {Object} [options] the serialization options
     * @return {String} the exported JSON data
     */


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
                }
            }
            Base.splice(children, items, index, 0);
            //var project = this._project,
                // See #_remove() for an explanation of this:
            //    notifySelf = project._changes;
            for (var i = 0, l = items.length; i < l; i++) {
                var item = items[i],
                    name = item._name;
                item._parent = this;
                // Set the name again to make sure all name lookup structures
                // are kept in sync.
                if (name)
                    item.setName(name);
                //if (notifySelf)
                //    this._changed(/*#=*/Change.INSERTION);
            }
            //this._changed(/*#=*/Change.CHILDREN);
        } else {
            items = null;
        }
        return items;
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
            
            return child;
        }
        return this;
    },




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
                // pass true for _dontMerge so we don't recursively transform
            if (pivot)
                _matrix._transformPoint(pivot, pivot, true);
           
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


}));
