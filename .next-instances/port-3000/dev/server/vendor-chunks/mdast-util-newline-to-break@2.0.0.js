"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/mdast-util-newline-to-break@2.0.0";
exports.ids = ["vendor-chunks/mdast-util-newline-to-break@2.0.0"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/mdast-util-newline-to-break@2.0.0/node_modules/mdast-util-newline-to-break/lib/index.js":
/*!********************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/mdast-util-newline-to-break@2.0.0/node_modules/mdast-util-newline-to-break/lib/index.js ***!
  \********************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   newlineToBreak: () => (/* binding */ newlineToBreak)\n/* harmony export */ });\n/* harmony import */ var mdast_util_find_and_replace__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mdast-util-find-and-replace */ \"(ssr)/./node_modules/.pnpm/mdast-util-find-and-replace@3.0.2/node_modules/mdast-util-find-and-replace/lib/index.js\");\n/**\n * @typedef {import('mdast').Nodes} Nodes\n * @typedef {import('mdast-util-find-and-replace').ReplaceFunction} ReplaceFunction\n */\n\n\n\n/**\n * Turn normal line endings into hard breaks.\n *\n * @param {Nodes} tree\n *   Tree to change.\n * @returns {undefined}\n *   Nothing.\n */\nfunction newlineToBreak(tree) {\n  (0,mdast_util_find_and_replace__WEBPACK_IMPORTED_MODULE_0__.findAndReplace)(tree, [/\\r?\\n|\\r/g, replace])\n}\n\n/**\n * Replace line endings.\n *\n * @type {ReplaceFunction}\n */\nfunction replace() {\n  return {type: 'break'}\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vbWRhc3QtdXRpbC1uZXdsaW5lLXRvLWJyZWFrQDIuMC4wL25vZGVfbW9kdWxlcy9tZGFzdC11dGlsLW5ld2xpbmUtdG8tYnJlYWsvbGliL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQSxhQUFhLHVCQUF1QjtBQUNwQyxhQUFhLHVEQUF1RDtBQUNwRTs7QUFFMEQ7O0FBRTFEO0FBQ0E7QUFDQTtBQUNBLFdBQVcsT0FBTztBQUNsQjtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ087QUFDUCxFQUFFLDJFQUFjO0FBQ2hCOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0EsVUFBVTtBQUNWIiwic291cmNlcyI6WyIvVXNlcnMvc3RpbGxidWxsZG9nMzUvRG9jdW1lbnRzL3BlcnNvbmFsR2l0aHViL3RoZS1kZXYtc3F1YWQvbm9kZV9tb2R1bGVzLy5wbnBtL21kYXN0LXV0aWwtbmV3bGluZS10by1icmVha0AyLjAuMC9ub2RlX21vZHVsZXMvbWRhc3QtdXRpbC1uZXdsaW5lLXRvLWJyZWFrL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEB0eXBlZGVmIHtpbXBvcnQoJ21kYXN0JykuTm9kZXN9IE5vZGVzXG4gKiBAdHlwZWRlZiB7aW1wb3J0KCdtZGFzdC11dGlsLWZpbmQtYW5kLXJlcGxhY2UnKS5SZXBsYWNlRnVuY3Rpb259IFJlcGxhY2VGdW5jdGlvblxuICovXG5cbmltcG9ydCB7ZmluZEFuZFJlcGxhY2V9IGZyb20gJ21kYXN0LXV0aWwtZmluZC1hbmQtcmVwbGFjZSdcblxuLyoqXG4gKiBUdXJuIG5vcm1hbCBsaW5lIGVuZGluZ3MgaW50byBoYXJkIGJyZWFrcy5cbiAqXG4gKiBAcGFyYW0ge05vZGVzfSB0cmVlXG4gKiAgIFRyZWUgdG8gY2hhbmdlLlxuICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAqICAgTm90aGluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5ld2xpbmVUb0JyZWFrKHRyZWUpIHtcbiAgZmluZEFuZFJlcGxhY2UodHJlZSwgWy9cXHI/XFxufFxcci9nLCByZXBsYWNlXSlcbn1cblxuLyoqXG4gKiBSZXBsYWNlIGxpbmUgZW5kaW5ncy5cbiAqXG4gKiBAdHlwZSB7UmVwbGFjZUZ1bmN0aW9ufVxuICovXG5mdW5jdGlvbiByZXBsYWNlKCkge1xuICByZXR1cm4ge3R5cGU6ICdicmVhayd9XG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/mdast-util-newline-to-break@2.0.0/node_modules/mdast-util-newline-to-break/lib/index.js\n");

/***/ })

};
;