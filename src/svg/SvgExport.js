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
 * A function scope holding all the functionality needed to convert a
 * Paper.js DOM to a SVG DOM.
 */
new function() {
    // TODO: Consider moving formatter into options object, and pass it along.
    var formatter;

    function getTransform(matrix, coordinates, center) {
        // Use new Base() so we can use Base#set() on it.
        var attrs = new Base(),
            trans = matrix.getTranslation();
        if (coordinates) {
            // If the item suppports x- and y- coordinates, we're taking out the
            // translation part of the matrix and move it to x, y attributes, to
            // produce more readable markup, and not have to use center points
            // in rotate(). To do so, SVG requries us to inverse transform the
            // translation point by the matrix itself, since they are provided
            // in local coordinates.
            matrix = matrix._shiftless();
            var point = matrix._inverseTransform(trans);
            attrs[center ? 'cx' : 'x'] = point.x;
            attrs[center ? 'cy' : 'y'] = point.y;
            trans = null;
        }
        if (!matrix.isIdentity()) {
            // See if we can decompose the matrix and can formulate it as a
            // simple translate/scale/rotate command sequence.
            var decomposed = matrix.decompose();
            if (decomposed) {
                var parts = [],
                    angle = decomposed.rotation,
                    scale = decomposed.scaling,
                    skew = decomposed.skewing;
                if (trans && !trans.isZero())
                    parts.push('translate(' + formatter.point(trans) + ')');
                if (angle)
                    parts.push('rotate(' + formatter.number(angle) + ')');
                if (!Numerical.isZero(scale.x - 1)
                        || !Numerical.isZero(scale.y - 1))
                    parts.push('scale(' + formatter.point(scale) +')');
                if (skew && skew.x)
                    parts.push('skewX(' + formatter.number(skew.x) + ')');
                if (skew && skew.y)
                    parts.push('skewY(' + formatter.number(skew.y) + ')');
                attrs.transform = parts.join(' ');
            } else {
                attrs.transform = 'matrix(' + matrix.getValues().join(',') + ')';
            }
        }
        return attrs;
    }

    function exportPath(item, options) {
        return item.getPathData(null, options.precision);
    }

    function exportCompoundPath(item, options) {
        return item.getPathData(null, options.precision);
    }

    var exporters = {
        Path: exportPath,
        CompoundPath: exportCompoundPath
    };

    var definitions;
    function getDefinition(item, type) {
        if (!definitions)
            definitions = { ids: {}, svgs: {} };
        // Use #__id for items that don't have internal #_id properties (Color),
        // and give them ids from their own private id pool named 'svg'.
        var id = item._id || item.__id || (item.__id = UID.get('svg'));
        return item && definitions.svgs[type + '-' + id];
    }

    function setDefinition(item, node, type) {
        // Make sure the definitions lookup is created before we use it.
        // This is required by 'clip', where getDefinition() is not called.
        if (!definitions)
            getDefinition();
        // Have different id ranges per type
        var typeId = definitions.ids[type] = (definitions.ids[type] || 0) + 1;
        // Give the svg node an id, and link to it from the item id.
        node.id = type + '-' + typeId;
        // See getDefinition() for an explanation of #__id:
        definitions.svgs[type + '-' + (item._id || item.__id)] = node;
    }

    function exportDefinitions(node, options) {
        var svg = node,
            defs = null;
        if (definitions) {
            // We can only use svg nodes as defintion containers. Have the loop
            // produce one if it's a single item of another type (when calling
            // #exportSVG() on an item rather than a whole project)
            // jsdom in Node.js uses uppercase values for nodeName...
            svg = node.nodeName.toLowerCase() === 'svg' && node;
            for (var i in definitions.svgs) {
                // This code is inside the loop so we only create a container if
                // we actually have svgs.
                if (!defs) {
                    if (!svg) {
                        svg = SvgElement.create('svg');
                        svg.appendChild(node);
                    }
                    defs = svg.insertBefore(SvgElement.create('defs'),
                            svg.firstChild);
                }
                defs.appendChild(definitions.svgs[i]);
            }
            // Clear definitions at the end of export
            definitions = null;
        }
        return options.asString
                ? new self.XMLSerializer().serializeToString(svg)
                : svg;
    }

    function exportSVG(item, options, isRoot) {
        var exporter = exporters[item._class],
            node = exporter && exporter(item, options);
        if (node) {
            // Support onExportItem callback, to provide mechanism to handle
            // special attributes (e.g. inkscape:transform-center)
            var onExport = options.onExport;
            if (onExport)
                node = onExport(item, node, options) || node;
            var data = JSON.stringify(item._data);
            if (data && data !== '{}' && data !== 'null')
                node.setAttribute('data-paper-data', data);
        }
        return node
    }

    function setOptions(options) {
        if (!options)
            options = {};
        formatter = new Formatter(options.precision);
        return options;
    }

    Item.inject({
        exportSVG: function(options) {
            options = setOptions(options);
            return exportDefinitions(exportSVG(this, options, true), options);
        }
    });
};
