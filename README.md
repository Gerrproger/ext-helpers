# ExtHelpers

#### A set of libraries for convenient browser extensions development!

- All libraries share unified version number.
- All libraries are tested and support Chrome 50+ (and other Chromium based analogs).
- No special manifest permissions needed unless otherwise specified for a particular library.
- Each library does not depend on others but compatible with them (of course).
- Each library is designed to perform one function and to speed up and simplify development when compared with using standard extensions api.
- Unit tests will come out someday™.

### Installation
Just import library or include via script tag, or include script file using manifest. Then initialize its class.\
Some libraries need to be included in background or content scripts or into both, refer to the documentation for the specific library.

```js
import ExtStorageManager from "/deps/ext-storage-manager.js";
```
Or:
```html
<script src="/deps/ext-storage-manager.js"></script>
```
Or in `manifest.json`:
```json
{
  "manifest_version": 2,
  "minimum_chrome_version": "50",
  "permissions": [
    "storage",
    "<all_urls>"
  ],
  "background": {
    "scripts": [
      "/deps/ext-storage-manager.min.js",
      "/background.js"
    ]
  },
  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "/deps/ext-storage-manager.min.js",
        "/content.js"
      ]
    }
  ],
  ...
}
```
Then:
```js
const storage = new ExtStorageManager({}, init);
```

## [ExtStorageManager](docs/ext-storage-manager.md)
Serves as a convenient wrapper over the storage api.\
Allows you to perform actions with the storage absolutely synchronously!\
Conveniently access nested storage objects and subscribe to their changes.\
Set default storage contents.

## [ExtAutoInject](docs/ext-auto-inject.md)
Automatically injects your content scripts during extension installation or update.\
Users immediately see your extension working without having to reload tabs!\
Conveniently allows you to interrupt the execution of old content scripts and initialize new (updated) ones.\
Injects content scripts and css specified in your manifest into suitable tabs and returns metadata such as  extension version and update date.

## [ExtActiveTabState](docs/ext-active-tab-state.md)
Allows to get the metadata of the currently opened (focused) tab.\
Moreover, you can provide any data from the active tab (through content script)!\
Conveniently subscribe to this data from specific pages using namespaces.\
In sum, every time the user switches between tabs, you can receive data and the state of the active tab.

## [ExtSinglePageOpener](docs/ext-single-page-opener.md)
Open any links in new tabs or windows only once.\
Does not require any additional permissions (such as **tabs**)!\
Conveniently allows you to create a new tab with the url or focus on an already opened with this url tab without creating a new one.\
Also allows you to set tabs parameters, for example open in a new window without an omnibox.
