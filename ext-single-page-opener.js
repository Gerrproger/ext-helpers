/*!
 * ExtSinglePageOpener
 * Part of the ExtHelpers project
 * @version  v1.7.0
 * @author   Gerrproger
 * @license  MIT License
 * Repo:     http://github.com/gerrproger/ext-helpers
 * Issues:   http://github.com/gerrproger/ext-helpers/issues
 */
(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root, document);
  } else if (typeof define === 'function' && define.amd) {
    define(null, function () {
      factory(root, document);
    });
  } else {
    root.ExtSinglePageOpener = factory(root, document);
  }
})(typeof window !== 'undefined' ? window : this, function (window, document) {
  'use strict';

  class ExtSinglePageOpener {
    constructor() {
      this.isBackgroundScript = !!(chrome.extension.getBackgroundPage && chrome.extension.getBackgroundPage() === window);
      this.pages = new Map();

      this.isBackgroundScript && this._prepareBackground();
    }

    _prepareBackground() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request.extSinglePageOpener) {
          return;
        }
        this._openBackground(request.extSinglePageOpener, sendResponse);
        return true;
      });
    }

    _openBackground(opts, callback) {
      const url = this._getUrl(opts);
      const splittedUrl = this._splitUrl(url);
      const tabId = this.pages.get(splittedUrl[0]);
      const updateObj = { active: true };

      if (!tabId) {
        this._openNewTab(opts, callback);
        return;
      }

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          this._openNewTab(opts, callback);
          return;
        }

        if (splittedUrl.length > 1) {
          updateObj.url = url;
        }
        chrome.windows.update(tab.windowId, { focused: true });
        chrome.tabs.update(tab.id, updateObj, callback);
      });
    }

    _openContent(opts, callback) {
      chrome.runtime.sendMessage({ extSinglePageOpener: opts }, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          throw new Error('ExtSinglePageOpener should also be initilized in the background page script!');
        }
        callback.call(window, tab);
      });
    }

    _openNewTab(opts, callback) {
      const url = this._getUrl(opts);
      const tabLoaded = (tab) => {
        this.pages.set(this._splitUrl(url)[0], tab.id);
        callback.call(window, tab);
      };

      if (opts.type) {
        chrome.windows.create({ ...opts, focused: true, url }, (wind) => {
          tabLoaded(wind.tabs[0]);
        });
        return;
      }

      chrome.windows.getCurrent({}, (window) => {
        if (window) {
          chrome.windows.update(window.id, { focused: true });
          chrome.tabs.create({ url }, tabLoaded);
          return;
        }

        chrome.windows.create({ focused: true, url }, (wind) => {
          tabLoaded(wind.tabs[0]);
        });
      });
    }

    _getUrl(opts) {
      const url = opts.url || opts;
      const match = url.match(/^@@dir(.*)/);
      return match ? chrome.extension.getURL(match[1]) : url;
    }

    _splitUrl(url) {
      return url.split(/\?|#/);
    }

    open(opts, callback = () => {}) {
      if (typeof callback !== 'function') {
        throw new Error('Callback should be a function!');
      }
      if (!opts || !(typeof opts === 'string' || (typeof opts === 'object' && typeof opts.url === 'string'))) {
        throw new Error('URL or settings object with URL string is not provided!');
      }

      this.isBackgroundScript ? this._openBackground(opts, callback) : this._openContent(opts, callback);
    }
  }

  return ExtSinglePageOpener;
});
