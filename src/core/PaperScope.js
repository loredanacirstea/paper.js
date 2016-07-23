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
 * @name PaperScope
 *
 * @class The `PaperScope` class represents the scope associated with a Paper
 *     context. When working with PaperScript, these scopes are automatically
 *     created for us, and through clever scoping the properties and methods of
 *     the active scope seem to become part of the global scope.
 *
 * When working with normal JavaScript code, `PaperScope` objects need to be
 * manually created and handled.
 *
 * Paper classes can only be accessed through `PaperScope` objects. Thus in
 * PaperScript they are global, while in JavaScript, they are available on the
 * global {@link paper} object. For JavaScript you can use {@link
 * PaperScope#install(scope) } to install the Paper classes and objects on the
 * global scope. Note that when working with more than one scope, this still
 * works for classes, but not for objects like {@link PaperScope#project}, since
 * they are not updated in the injected scope if scopes are switched.
 *
 * The global {@link paper} object is simply a reference to the currently active
 * `PaperScope`.
 */
var PaperScope = Base.extend(/** @lends PaperScope# */{
    _class: 'PaperScope',

    /**
     * Creates a PaperScope object.
     *
     * @name PaperScope#initialize
     * @function
     */
    // DOCS: initialize() parameters
    initialize: function PaperScope() {
        // element is only used internally when creating scopes for PaperScript.
        // Whenever a PaperScope is created, it automatically becomes the active
        // one.
        paper = this;
        // Default configurable settings.
        this.settings = new Base({
            applyMatrix: true,
            insertItems: true,
            handleSize: 4,
            hitTolerance: 0
        });
        this.project = null;
        this.projects = [];
        this.tools = [];
        this.palettes = [];
        // Assign a unique id to each scope .
        this._id = PaperScope._id++;
        PaperScope._scopes[this._id] = this;
        var proto = PaperScope.prototype;
    },

    /**
     * The version of Paper.js, as a string.
     *
     * @type String
     */
    version: /*#=*/__options.version,

 
    /**
     * Sets up an empty project for us. If a canvas is provided, it also creates
     * a {@link View} for it, both linked to this scope.
     *
     * @param {HTMLCanvasElement|String} element the HTML canvas element this
     * scope should be associated with, or an ID string by which to find the
     * element.
     */
    setup: function(element) {
        // Make sure this is the active scope, so the created project and view
        // are automatically associated with it.
        paper = this;
        // Create an empty project for the scope.
        this.project = new Project(element);
        // This is needed in PaperScript.load().
        return this;
    },


 
    statics: new function() {
        return /** @lends PaperScope */{
            _scopes: {},
            _id: 0,

            /**
             * Retrieves a PaperScope object with the given scope id.
             *
             * @param id
             */
            get: function(id) {
                return this._scopes[id] || null;
            },

        };
    }
});
