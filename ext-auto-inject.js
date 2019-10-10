/*!
 * ExtAutoInject
 * Part of the ExtHelpers project
 * @version  v1.3.0
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
        root.ExtAutoInject = factory(root, document);
    }
}(typeof window !== 'undefined' ? window : this, function (window, document) {
    "use strict";

    class ExtAutoInject {
        constructor(ignore, callback) {
            this.isBackgroundScript = !!(chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window);
            this.manifest = chrome.runtime.getManifest();
            !this.isBackgroundScript && (callback = ignore);
            if (callback && typeof callback !== 'function') {
                throw new Error('Callback should be a function!');
            }
            if (this.isBackgroundScript && ignore && typeof ignore !== 'string' && typeof ignore !== 'object') {
                throw new Error('Ignore parameter should be a sting (match pattern) or a regular expression or an array of strings/expressions!');
            }
            return new Promise((resolve) => {
                const callbackWrap = (res) => {
                    callback && callback.call(window, res);
                    resolve(res);
                };
                this.isBackgroundScript ? this.background(ignore, callbackWrap) : this.content(callbackWrap);
            });
        }

        background(ignore, callback) {
            const constructRegExp = str => new RegExp(`^${str.replace(/\?/g, '.').replace(/\*\.?/g, '.*').replace(/\//g, '\/').replace(/\./g, '\.')}$`);
            const inject = (id, injectOpts) => {
                const doInject = (type) => {
                    injectOpts.files[type].forEach((fileName) => {
                        chrome.tabs[type === 'js' ? 'executeScript' : 'insertCSS'](id, {
                            file: fileName,
                            allFrames: injectOpts.allFrames,
                            matchAboutBlank: injectOpts.matchAboutBlank
                        });
                    });
                };

                chrome.tabs.executeScript(id, {
                    code: `window.extAutoInjectData = ${JSON.stringify(infoRes)};`
                }, () => {
                    if (chrome.runtime.lastError) {
                        switch (chrome.runtime.lastError.message) {
                            case 'The extensions gallery cannot be scripted.': return;
                            case 'The tab was closed.': return;
                            default: throw new Error(chrome.runtime.lastError.message);
                        }
                    }
                    doInject('js');
                    doInject('css');
                });
            };
            const checkFileNames = (cs) => {
                const injectOpts = {
                    allFrames: cs.all_frames,
                    matchAboutBlank: cs.match_about_blank,
                    files: {}
                };
                const doCheck = (type) => {
                    injectOpts.files[type] = cs[type].filter((fileName) => {
                        const isIgnored = ignoring.some((ignore) => {
                            if (fileName.match(ignore)) {
                                return true;
                            }
                        });
                        return !isIgnored;
                    });
                };

                doCheck('js');
                doCheck('css');
                return injectOpts;
            };
            const queryTabs = () => {
                this.manifest.content_scripts.forEach((cs) => {
                    const injectOpts = checkFileNames(cs);
                    chrome.tabs.query({ url: cs.matches }, (tabs) => {
                        tabs && tabs.forEach((tab) => {
                            let toIgnore = [];
                            cs.exclude_matches && (toIgnore = toIgnore.concat(cs.exclude_matches));
                            cs.exclude_globs && (toIgnore = toIgnore.concat(cs.exclude_globs));
                            const ignored = toIgnore.some((ignore) => {
                                ignore = constructRegExp(ignore);
                                if (tab.url.match(ignore)) {
                                    return true;
                                }
                            });
                            if (ignored) {
                                return;
                            }

                            if (cs.include_globs) {
                                const included = cs.include_globs.some((include) => {
                                    include = constructRegExp(include);
                                    if (tab.url.match(include)) {
                                        return true;
                                    }
                                });
                                if (!included) {
                                    return;
                                }
                            }

                            inject(tab.id, injectOpts);
                        });
                    });
                });
            };

            let infoRes = null;
            let ignoring = (typeof ignore === 'object' || typeof ignore === 'string') ? (Array.isArray(ignore) ? ignore : [ignore]) : [];
            ignoring = ignoring.map((ignore) => {
                return typeof ignore === 'string' ? constructRegExp(ignore) : ignore;
            });

            chrome.runtime.onInstalled.addListener((details) => {
                infoRes = {
                    version: this.manifest.version,
                    previousVersion: details.previousVersion,
                    reason: details.reason
                };
                callback(infoRes);
                ignore !== false && queryTabs();
            });
        }

        content(callback) {
            const catchMessage = (event) => {
                if (event.source !== window || !event.data.extAutoInjected) {
                    return;
                }
                window.removeEventListener('message', catchMessage);
                callback();
            };

            window.postMessage({ extAutoInjected: true }, '*');
            setTimeout(() => {
                window.addEventListener('message', catchMessage);
            });
        }
    }

    return ExtAutoInject;
}));