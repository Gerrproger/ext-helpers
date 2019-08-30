/*!
 * ExtStorageManager
 * Part of the ExtHelpers project
 * @version  v1.0.0
 * @author   Gerrproger
 * @license  MIT License
 * Repo:     http://github.com/gerrproger/ext-helpers
 * Issues:   http://github.com/gerrproger/ext-helpers/issues
 */
; (function (root, factory) {
    "use strict";

    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory(root, document);
    } else if (typeof define === 'function' && define.amd) {
        define(null, function () {
            factory(root, document);
        });
    } else {
        root.ExtStorageManager = factory(root, document);
    }
}(typeof window !== 'undefined' ? window : this, function (window, document) {
    "use strict";

    const ExtStorageManager = function (defData, after, name) {
        class Storage {
            constructor(name, defData, after) {
                this.name = name;
                this.after = after;
                this.onUpdateCalls = [];
                this.data = {};
                this.defData = defData;
                this.skip = false;
                this.api = {
                    get: this.get.bind(this),
                    set: this.set.bind(this),
                    remove: this.remove.bind(this),
                    onUpdate: this.onUpdate.bind(this),
                    reset: this.reset.bind(this),
                    clear: this.clear.bind(this)
                };
                chrome.storage[name].get(this._checkStorage.bind(this));
                chrome.storage.onChanged.addListener(this._updateStorage.bind(this));
            }

            _checkStorage(opts) {
                const merge = this._extend(opts, this.defData);
                this.data = merge.object;
                if (merge.changed.length) {
                    const changed = {};
                    merge.changed.forEach((key) => {
                        changed[key] = this.data[key];
                    });
                    chrome.storage[this.name].set(changed);
                }
                this.after(this.get());
            }

            _isObject(v) {
                const type = typeof v;
                return v !== null && type === 'object';
            }

            _copyObject(o) {
                return JSON.parse(JSON.stringify(o));
            }

            _extend(obj1, obj2) {
                const changed = [];
                const addChanged = (v) => {
                    !changed.includes(v) && changed.push(v);
                };
                const iter = (o1, o2, parentKey) => {
                    Object.keys(o2).forEach((key) => {
                        if (o1[key] === undefined) {
                            o1[key] = o2[key];
                            addChanged(parentKey || key);
                        } else if (this._isObject(o2[key])) {
                            iter(o1[key], o2[key], parentKey || key);
                        }
                    });
                };
                obj1 = this._copyObject(obj1 || {});
                obj2 = this._copyObject(obj2 || {});
                iter(obj1, obj2);
                return {
                    object: obj1,
                    changed
                };
            }

            _updateStorage(opts, area) {
                if (area !== this.name || this.skip) {
                    return;
                }
                const changed = [];
                const iter = (o1, o2, allKey) => {
                    Object.keys(o1).forEach((key) => {
                        if (this._isObject(o1[key]) && this._isObject(o2[key])) {
                            iter(o1[key], o2[key], `${allKey}.${key}`);
                        } else if (o1[key] !== o2[key]) {
                            changed.push(`${allKey}.${key}`);
                        }
                    });
                };
                Object.keys(opts).forEach((key) => {
                    if (!opts[key].hasOwnProperty('newValue')) {
                        delete this.data[key];
                        changed.push(key);
                        return;
                    }
                    if (this._isObject(opts[key].newValue) && this._isObject(this.data[key])) {
                        iter(opts[key].newValue, this.data[key], key);
                    } else if (opts[key].newValue !== this.data[key]) {
                        changed.push(key);
                    }
                    this.data[key] = opts[key].newValue;
                });
                changed.forEach((path) => {
                    this.onUpdateCalls.forEach((caller) => {
                        if (new RegExp(`^${path.replace(/\./g, '\\.')}`).test(caller[0])) {
                            caller[1](this.get(caller[0]));
                        }
                    })
                });
            }

            _replaceStorage(newData) {
                newData = this._copyObject(newData);
                const toRemove = Object.keys(this.data).filter(key => !newData.hasOwnProperty(key));
                this.data = newData;
                this.skip = true;
                toRemove.length && chrome.storage[this.name].remove(toRemove);
                chrome.storage[this.name].set(this.data, () => this.skip = false);
            }

            get(path) {
                if (!path) {
                    return this._copyObject(this.data);
                }
                let temp = this.data;
                const notFound = path.split(/\./g).some((key) => {
                    if (temp && temp[key]) {
                        temp = temp[key];
                    } else {
                        return true;
                    }
                });
                return notFound ? undefined : (this._isObject(temp) ? this._copyObject(temp) : temp);
            }

            set(path, value) {
                if (path && typeof path !== 'string') {
                    throw new Error('Path shold be a string!')
                };
                this._isObject(value) && (value = this._copyObject(value));
                if (!path) {
                    if (!this._isObject(value)) {
                        throw new Error('Could not store a non-object in the storage!');
                    }
                    this._replaceStorage(value);
                    return this.api;
                }
                let temp = this.data;
                const pathArray = path.split(/\./g);
                const pathLength = pathArray.length - 1;
                const error = pathArray.some((key, i) => {
                    if (i === pathLength) {
                        temp[key] = value;
                    } else if (temp[key] === undefined) {
                        temp = temp[key] = {};
                    } else if (this._isObject(temp[key])) {
                        temp = temp[key];
                    } else {
                        return true;
                    }
                });
                if (error) {
                    throw new Error('Could not store value in a non-object!');
                } else {
                    chrome.storage[this.name].set({ [pathArray[0]]: this.data[pathArray[0]] });
                    return this.api;
                }
            }

            remove(path) {
                if (!path) {
                    throw new Error('Path is not provided!');
                }
                const pathArray = path.split(/\./g);
                const pathLength = pathArray.length - 1;
                if (!pathLength) {
                    if (!this.data[pathArray[0]]) {
                        throw new Error('Provided path is invalid!');
                    }
                    delete this.data[pathArray[0]];
                    chrome.storage[this.name].remove(pathArray[0]);
                    return this.api;
                }
                let temp = this.data;
                const error = pathArray.some((key, i) => {
                    if (i === pathLength) {
                        if (!this._isObject(temp[key])) {
                            return true;
                        } else {
                            delete temp[key];
                            chrome.storage[this.name].set({ [pathArray[0]]: this.data[pathArray[0]] });
                        }
                    } else if (this._isObject(temp[key])) {
                        temp = temp[key];
                    } else {
                        return true;
                    }
                });
                if (error) {
                    throw new Error('Provided path is not an object!');
                } else {
                    return this.api;
                }
            }

            onUpdate(path, after) {
                path = path || '';
                if (!after) {
                    throw new Error('Function is not provided!');
                }
                this.onUpdateCalls.push([path, after]);
                return this.api;
            }

            reset() {
                this._replaceStorage(this.defData);
                return this.api;
            }

            clear() {
                this._replaceStorage({});
                return this.api;
            }
        }

        name = name || 'sync';
        after = after || (() => { });
        defData = defData || {};

        const inst = new Storage(name, defData, after);
        return inst.api;
    };

    return ExtStorageManager;
}));