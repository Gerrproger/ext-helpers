/*!
 * ExtActiveTabState
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
        root.ExtActiveTabState = factory(root, document);
    }
}(typeof window !== 'undefined' ? window : this, function (window, document) {
    "use strict";

    class ExtActiveTabState {
        constructor(callback, namespace) {
            this.isBackgroundScript = !!(chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window);
            if (callback || namespace) {
                this.checkParams(callback, namespace);
            }
            return this.checkParams.bind(this);
        }

        checkParams(callback, namespace) {
            if (typeof callback !== 'function' && this.isBackgroundScript) {
                throw new Error('Callback should be a function!');
            }
            if (namespace && typeof namespace !== 'string' && (!this.isBackgroundScript || typeof namespace !== 'boolean')) {
                throw new Error(`Namespace should be a string${this.isBackgroundScript ? ' or a a boolean' : ''}!`);
            }
            this.isBackgroundScript ? this.background(callback, namespace) : this.content(callback, namespace);
            return this.checkParams.bind(this);
        }

        background(callback, namespace) {
            let lastTabId = null;
            let lastWindId = null;
            const checkTab = () => {
                chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (!tab) {
                        return;
                    }
                    lastWindId = tab.windowId;
                    if (tab.id === lastTabId) {
                        return;
                    }
                    lastTabId = tab.id;
                    if (namespace) {
                        requestState(tab);
                        return;
                    }
                    callback.call(window, tab);
                });
            };
            const checkUpdate = (tabId, info, tab) => {
                if (info.status !== 'complete' || tab.windowId !== lastWindId || !tab.active) {
                    return;
                }
                if (namespace) {
                    requestState(tab);
                    return;
                }
                callback.call(window, tab);
            };
            const requestState = (tab) => {
                chrome.tabs.sendMessage(tab.id, { extActiveTabState: { namespace: typeof namespace === 'string' ? namespace : undefined } }, (response) => {
                    if (chrome.runtime.lastError) {
                        callback.call(window, tab);
                        switch (chrome.runtime.lastError.message) {
                            case 'Could not establish connection. Receiving end does not exist.':
                            case 'The message port closed before a response was received.': return;
                            default: throw new Error(chrome.runtime.lastError.message);
                        }
                    }
                    callback.call(window, tab, response.extActiveTabState.response);
                });
            };

            checkTab();
            chrome.tabs.onActivated.addListener(checkTab);
            chrome.windows.onFocusChanged.addListener(checkTab);
            chrome.tabs.onUpdated.addListener(checkUpdate);
            chrome.tabs.onCreated.addListener((tab) => {
                if (!tab.active) {
                    return;
                }
                lastTabId = tab.id;
            });
        }

        content(callback, namespace) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (!request.extActiveTabState || (namespace && namespace !== request.extActiveTabState.namespace)) {
                    return;
                }
                const response = typeof callback === 'function' ? callback.call(window, request.extActiveTabState.namespace) : callback;
                sendResponse({ extActiveTabState: { response } });
                return true;
            });
        }
    }

    return ExtActiveTabState;
}));