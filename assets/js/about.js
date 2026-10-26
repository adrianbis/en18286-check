/* About page: if a team photo is missing or its file name doesn't match,
   show the person's initials instead of a broken image. */
(function () {
  "use strict";
  function fallback(img) {
    var span = document.createElement("span");
    span.className = "avatar";
    span.setAttribute("aria-hidden", "true");
    span.textContent = img.getAttribute("data-initials") || (img.alt || "?").charAt(0);
    img.replaceWith(span);
  }
  document.querySelectorAll("img.avatar").forEach(function (img) {
    img.loading = "eager"; // make sure the check below runs on load
    if (img.complete && img.naturalWidth === 0) fallback(img);
    else img.addEventListener("error", function () { fallback(img); });
  });
})();
