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
 * @name Base
 * @class
 * @private
 */
// Extend Base with utility functions used across the library.
Base.inject(/** @lends Base# */{
    /**
     * Renders base objects to strings in object literal notation.
     */



    statics: /** @lends Base */{

        // Keep track of all named classes for serialization and exporting.
        exports: {
            enumerable: true // For PaperScope.inject() in export.js
        },

        extend: function extend() {
            // Override Base.extend() to register named classes in Base.exports,
            // for deserialization and injection into PaperScope.
            var res = extend.base.apply(this, arguments),
                name = res.prototype._class;
            if (name && !Base.exports[name])
                Base.exports[name] = res;
            return res;
        },

        /**
         * Checks if two values or objects are equals to each other, by using
         * their equals() methods if available, and also comparing elements of
         * arrays and properties of objects.
         */
        equals: function(obj1, obj2) {
            if (obj1 === obj2)
                return true;
            // Call #equals() on both obj1 and obj2
            if (obj1 && obj1.equals)
                return obj1.equals(obj2);
            if (obj2 && obj2.equals)
                return obj2.equals(obj1);
            // Deep compare objects or arrays
            if (obj1 && obj2
                    && typeof obj1 === 'object' && typeof obj2 === 'object') {
                // Compare arrays
                if (Array.isArray(obj1) && Array.isArray(obj2)) {
                    var length = obj1.length;
                    if (length !== obj2.length)
                        return false;
                    while (length--) {
                        if (!Base.equals(obj1[length], obj2[length]))
                            return false;
                    }
                } else {
                    // Deep compare objects.
                    var keys = Object.keys(obj1),
                        length = keys.length;
                    // Ensure that both objects contain the same number of
                    // properties before comparing deep equality.
                    if (length !== Object.keys(obj2).length)
                        return false;
                    while (length--) {
                        // Deep compare each member
                        var key = keys[length];
                        if (!(obj2.hasOwnProperty(key)
                                && Base.equals(obj1[key], obj2[key])))
                            return false;
                    }
                }
                return true;
            }
            return false;
        },

        /**
         * When called on a subclass of Base, it reads arguments of the type of
         * the subclass from the passed arguments list or array, at the given
         * index, up to the specified length.
         * When called directly on Base, it reads any value without conversion
         * from the passed arguments list or array.
         * This is used in argument conversion, e.g. by all basic types (Point,
         * Size, Rectangle) and also higher classes such as Color and Segment.
         *
         * @param {Array} list the list to read from, either an arguments object
         *     or a normal array
         * @param {Number} start the index at which to start reading in the list
         * @param {Object} options `options.readNull` controls whether null is
         *     returned or converted. `options.clone` controls whether passed
         *     objects should be cloned if they are already provided in the
         *     required type
         * @param {Number} length the amount of elements that can be read
         */
        read: function(list, start, options, amount) {
            // See if it's called directly on Base, and if so, read value and
            // return without object conversion.
            if (this === Base) {
                var value = this.peek(list, start);
                list.__index++;
                return value;
            }
            var proto = this.prototype,
                readIndex = proto._readIndex,
                begin = start || readIndex && list.__index || 0,
                length = list.length,
                obj = list[begin];
            amount = amount || length - begin;
            // When read() is called on a sub-class of which the object is
            // already an instance, or when there is only one value in the list
            // and it's null or undefined, return the obj.
            if (obj instanceof this
                || options && options.readNull && obj == null && amount <= 1) {
                if (readIndex)
                    list.__index = begin + 1;
                return obj && options && options.clone ? obj.clone() : obj;
            }
            // Otherwise, create a new object and read through its initialize
            // function.
            obj = Base.create(this.prototype);
            if (readIndex)
                obj.__read = true;
            obj = obj.initialize.apply(obj, begin > 0 || begin + amount < length
                    ? Base.slice(list, begin, begin + amount)
                    : list) || obj;
            if (readIndex) {
                list.__index = begin + obj.__read;
                obj.__read = undefined;
            }
            return obj;
        },

        /**
         * Allows peeking ahead in reading of values and objects from arguments
         * list through Base.read().
         *
         * @param {Array} list the list to read from, either an arguments object
         * or a normal array
         * @param {Number} start the index at which to start reading in the list
         */
        peek: function(list, start) {
            return list[list.__index = start || list.__index || 0];
        },

        /**
         * Returns how many arguments remain to be read in the argument list.
         */
        remain: function(list) {
            return list.length - (list.__index || 0);
        },

        /**
         * Reads all readable arguments from the list, handling nested arrays
         * separately.
         *
         * @param {Array} list the list to read from, either an arguments object
         *     or a normal array
         * @param {Number} start the index at which to start reading in the list
         * @param {Object} options `options.readNull` controls whether null is
         *     returned or converted. `options.clone` controls whether passed
         *     objects should be cloned if they are already provided in the
         *     required type
         * @param {Number} amount the amount of elements that should be read
         */
        readList: function(list, start, options, amount) {
            var res = [],
                entry,
                begin = start || 0,
                end = amount ? begin + amount : list.length;
            for (var i = begin; i < end; i++) {
                res.push(Array.isArray(entry = list[i])
                        ? this.read(entry, 0, options)
                        : this.read(list, i, options, 1));
            }
            return res;
        },

        /**
         * Allows using of Base.read() mechanism in combination with reading
         * named arguments form a passed property object literal. Calling
         * Base.readNamed() can read both from such named properties and normal
         * unnamed arguments through Base.read(). In use for example for the
         * various Path.Constructors.
         *
         * @param {Array} list the list to read from, either an arguments object
         *     or a normal array
         * @param {String} name the property name to read from
         * @param {Number} start the index at which to start reading in the list
         * @param {Object} options `options.readNull` controls whether null is
         *     returned or converted. `options.clone` controls whether passed
         *     objects should be cloned if they are already provided in the
         *     required type
         * @param {Number} amount the amount of elements that can be read
         */
        readNamed: function(list, name, start, options, amount) {
            var value = this.getNamed(list, name),
                hasObject = value !== undefined;
            if (hasObject) {
                // Create a _filtered object that inherits from argument 0, and
                // override all fields that were already read with undefined.
                var filtered = list._filtered;
                if (!filtered) {
                    filtered = list._filtered = Base.create(list[0]);
                    // Point _filtering to the original so Base#_set() can
                    // execute hasOwnProperty on it.
                    filtered._filtering = list[0];
                }
                // delete wouldn't work since the masked parent's value would
                // shine through.
                filtered[name] = undefined;
            }
            return this.read(hasObject ? [value] : list, start, options, amount);
        },


   

        /**
         * Utility function for adding and removing items from a list of which
         * each entry keeps a reference to its index in the list in the private
         * _index property. Used for PaperScope#projects and Item#children.
         */
        splice: function(list, items, index, remove) {
            var amount = items && items.length,
                append = index === undefined;
            index = append ? list.length : index;
            if (index > list.length)
                index = list.length;
            // Update _index on the items to be added first.
            for (var i = 0; i < amount; i++)
                items[i]._index = index + i;
            if (append) {
                // Append them all at the end by using push
                list.push.apply(list, items);
                // Nothing removed, and nothing to adjust above
                return [];
            } else {
                // Insert somewhere else and/or remove
                var args = [index, remove];
                if (items)
                    args.push.apply(args, items);
                var removed = list.splice.apply(list, args);
                // Erase the indices of the removed items
                for (var i = 0, l = removed.length; i < l; i++)
                    removed[i]._index = undefined;
                // Adjust the indices of the items above.
                for (var i = index + amount, l = list.length; i < l; i++)
                    list[i]._index = i;
                return removed;
            }
        },

        /**
         * Capitalizes the passed string: hello world -> Hello World
         */
        capitalize: function(str) {
            return str.replace(/\b[a-z]/g, function(match) {
                return match.toUpperCase();
            });
        },

        /**
         * Camelizes the passed hyphenated string: caps-lock -> capsLock
         */
        camelize: function(str) {
            return str.replace(/-(.)/g, function(all, chr) {
                return chr.toUpperCase();
            });
        },

        /**
         * Converst camelized strings to hyphenated ones: CapsLock -> caps-lock
         */
        hyphenate: function(str) {
            return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        }
    }
});
