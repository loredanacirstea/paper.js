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
 * @name Project
 *
 * @class A Project object in Paper.js is what usually is referred to as the
 * document: The top level object that holds all the items contained in the
 * scene graph. As the term document is already taken in the browser context,
 * it is called Project.
 *
 * Projects allow the manipulation of the styles that are applied to all newly
 * created items, give access to the selected items, and will in future versions
 * offer ways to query for items in the scene graph defining specific
 * requirements, and means to persist and load from different formats, such as
 * SVG and PDF.
 *
 * The currently active project can be accessed through the
 * {@link PaperScope#project} variable.
 *
 * An array of all open projects is accessible through the
 * {@link PaperScope#projects} variable.
 */
var Project = Base.extend(Emitter,/** @lends Project# */{
    _class: 'Project',
    _list: 'projects',
    _reference: 'project',
    _compactSerialize: true, // Never include the class name for Project

    // TODO: Add arguments to define pages
    /**
     * Creates a Paper.js project containing one empty {@link Layer}, referenced
     * by {@link Project#activeLayer}.
     *
     * Note that when working with PaperScript, a project is automatically
     * created for us and the {@link PaperScope#project} variable points to it.
     *
     * @param {HTMLCanvasElement|String} element the HTML canvas element that
     * should be used as the element for the view, or an ID string by which to
     * find the element.
     */
    initialize: function Project(element) {
        // Activate straight away by passing true to PaperScopeItem constructor,
        // so paper.project is set, as required by Layer and DoumentView
        // constructors.

        this._children = [];
        this._namedChildren = {};
        this._activeLayer = null;
        //this._currentStyle = new Style(null, null, this);
        // If no view is provided, we create a 1x1 px canvas view just so we
        // have something to do size calculations with.
        // (e.g. PointText#_getBounds)
        this._selectionItems = {};
        this._selectionCount = 0;
        // See Item#draw() for an explanation of _updateVersion
        this._updateVersion = 0;
        // Change tracking, not in use for now. Activate once required:
        // this._changes = [];
        // this._changesById = {};
    },

    /**
     * Private notifier that is called whenever a change occurs in the project.
     *
     * @param {ChangeFlag} flags describes what exactly has changed
     * @param {Item} item the item that has caused the change
     */
    _changed: function(flags, item) {
        if (flags & /*#=*/ChangeFlag.APPEARANCE) {
            var view = this._view;
            if (view) {
                // Never draw changes right away. Simply mark view as "dirty"
                // and request an update through view.requestUpdate().
                view._needsUpdate = true;
                if (!view._requested && view._autoUpdate)
                    view.requestUpdate();
            }
        }
        // Have project keep track of changed items so they can be iterated.
        // This can be used for example to update the SVG tree. Needs to be
        // activated in Project
        var changes = this._changes;
        if (changes && item) {
            var changesById = this._changesById,
                id = item._id,
                entry = changesById[id];
            if (entry) {
                entry.flags |= flags;
            } else {
                changes.push(changesById[id] = { item: item, flags: flags });
            }
        }
    },

 


    /**
     * Inserts the specified layer at the specified index in this project's
     * {@link #layers} list.
     *
     * @param {Number} index the index at which to insert the layer
     * @param {Item} item the item to be inserted in the project
     * @return {Layer} the added layer, or `null` if adding was not possible
     */
    insertLayer: function(index, layer) {
        if (layer instanceof Group) {
            // Notify parent of change. Don't notify item itself yet,
            // as we're doing so when adding it to the new owner below.
            layer._remove(false, true);
            Base.splice(this._children, [layer], index, 0);
            layer._setProject(this, true);
            // Set the name again to make sure all name lookup structures
            // are kept in sync.
            var name = layer._name;
            if (name)
                layer.setName(name);
            // See Item#_remove() for an explanation of this:
            if (this._changes)
                layer._changed(/*#=*/Change.INSERTION);
            // TODO: this._changed(/*#=*/Change.LAYERS);
            // Also activate this layer if there was none before
            if (!this._activeLayer)
                this._activeLayer = layer;
        } else {
            layer = null;
        }
        return layer;
    },

    // Project#_insertItem() and Item#_insertItem() are helper functions called
    // in Item#copyTo(), and through _getOwner() in the various Item#insert*()
    // methods. They are called the same to facilitate so duck-typing.
    _insertItem: function(index, item, _created) {
        item = this.insertLayer(index, item)
                // Anything else than layers needs to be added to a layer first.
                // If none exists yet, create one now, then add the item to it.
                || (this._activeLayer || this._insertItem(undefined,
                        new Group(Item.NO_INSERT), true)) // _created = true
                        .insertChild(index, item);
        // If a layer was newly created, also activate it.
        if (_created && item.activate)
            item.activate();
        return item;
    },



});
