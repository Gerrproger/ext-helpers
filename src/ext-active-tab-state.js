/*!
 * ExtActiveTabState
 * Part of the ExtHelpers project
 * @version  v1.7.2
 * @author   Gerrproger
 * @license  MIT License
 * Repo:     http://github.com/gerrproger/ext-helpers
 * Issues:   http://github.com/gerrproger/ext-helpers/issues
 */
(function (root, factory) {
  /*eslint-disable */
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root, document);
  } else if (typeof define === 'function' && define.amd) {
    define(null, function () {
      factory(root, document);
    });
  } else {
    root.ExtActiveTabState = factory(root, document);
  }
})(typeof window !== 'undefined' ? window : this, function (window, document) {
  /*eslint-enable */
  'use strict';

  class ExtActiveTabState {
    constructor() {
      this.isBackgroundScript = !!(
        chrome.extension.getBackgroundPage &&
        chrome.extension.getBackgroundPage() === window
      );
      this.callbacksNoState = [];
      this.callbacks = {
        default: [],
      };
      this.api = {
        subscribe: this.subscribe.bind(this),
        unsubscribe: this.unsubscribe.bind(this),
      };
      this.isBackgroundScript ? this._initBackground() : this._initContent();
      return this.api;
    }

    subscribe(callback, namespace) {
      return this._processSubscriptions('subscribe', namespace, callback);
    }

    unsubscribe(namespace) {
      return this._processSubscriptions('unsubscribe', namespace);
    }

    _processSubscriptions(type, namespace, callback) {
      if (
        type === 'subscribe' &&
        typeof callback !== 'function' &&
        this.isBackgroundScript
      ) {
        throw new Error('Callback should be a function!');
      }
      if (
        namespace &&
        typeof namespace !== 'string' &&
        (!this.isBackgroundScript || typeof namespace !== 'boolean')
      ) {
        throw new Error(
          `Namespace should be a string${
            this.isBackgroundScript ? ' or a a boolean' : ''
          }!`
        );
      }

      if (!namespace && this.isBackgroundScript) {
        if (type === 'subscribe') {
          this.callbacksNoState.push(callback);
          window.dispatchEvent(new CustomEvent('checkTab'));
          return this.api;
        }
        this.callbacksNoState = [];
        return this.api;
      }

      namespace = typeof namespace === 'string' ? namespace : 'default';
      if (type === 'subscribe') {
        if (this.callbacks[namespace]) {
          this.callbacks[namespace].push(callback);
        } else {
          this.callbacks[namespace] = [callback];
        }
        window.dispatchEvent(new CustomEvent('checkTab'));
        return this.api;
      }
      this.callbacks[namespace] && (this.callbacks[namespace] = []);
      return this.api;
    }

    _initBackground() {
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
          processCallbacks(tab);
        });
      };
      const checkUpdate = (tabId, info, tab) => {
        if (
          info.status !== 'complete' ||
          tab.windowId !== lastWindId ||
          !tab.active
        ) {
          return;
        }
        processCallbacks(tab);
      };
      const processCallbacks = (tab) => {
        Object.keys(this.callbacks).forEach((namespace) => {
          requestState(tab, namespace, (response) => {
            this.callbacks[namespace].forEach((callback) => {
              callback.call(window, tab, response);
            });
          });
        });
        this.callbacksNoState.forEach((callback) => {
          callback.call(window, tab);
        });
      };
      const requestState = (tab, namespace, then) => {
        chrome.tabs.sendMessage(
          tab.id,
          { extActiveTabState: { namespace } },
          (response) => {
            if (chrome.runtime.lastError) {
              then();
              switch (chrome.runtime.lastError.message) {
                case 'Could not establish connection. Receiving end does not exist.':
                case 'The message port closed before a response was received.':
                  return;
                default:
                  throw new Error(chrome.runtime.lastError.message);
              }
            }
            then(response.extActiveTabState.response);
          }
        );
      };

      checkTab();
      chrome.tabs.onActivated.addListener(checkTab);
      chrome.windows.onFocusChanged.addListener(checkTab);
      chrome.tabs.onUpdated.addListener(checkUpdate);
      window.addEventListener('checkTab', () => {
        lastTabId = null;
        checkTab();
      });
      chrome.tabs.onCreated.addListener((tab) => {
        if (!tab.active) {
          return;
        }
        lastTabId = tab.id;
      });
    }

    _initContent() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        let namespace = 'default';
        if (!request.extActiveTabState) {
          return;
        }
        request.extActiveTabState.namespace &&
          (namespace = request.extActiveTabState.namespace);

        const response = this.callbacks[namespace]
          ? this.callbacks[namespace].reduce((resp, callback) => {
              const curr =
                typeof callback === 'function'
                  ? callback.call(window)
                  : callback;
              return Object.assign(resp, curr);
            }, {})
          : {};

        sendResponse({ extActiveTabState: { response } });
        return true;
      });
    }
  }

  return ExtActiveTabState;
});
