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

    initialize: function Project(element) {
        this._scope = paper;
        this._children = [];
        this._namedChildren = {};
        //this._activeLayer = null;
        // If no view is provided, we create a 1x1 px canvas view just so we
        // have something to do size calculations with.
        // (e.g. PointText#_getBounds)
        //this._view = View.create(this,
                //element || CanvasProvider.getCanvas(1, 1));
        this._selectionItems = {};
        this._selectionCount = 0;
        this._updateVersion = 0;
    },
});
