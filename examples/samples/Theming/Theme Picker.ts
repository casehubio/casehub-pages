// Toggle between full and compact mode.
// Written to survive stripTs() — no lowercase type annotations.

var picker = document.getElementById('demo-picker')!;
var toggleBtn = document.getElementById('mode-toggle')!;

toggleBtn.addEventListener('click', function() {
  var isCompact = picker.hasAttribute('compact');
  if (isCompact) {
    picker.removeAttribute('compact');
    toggleBtn.textContent = 'Switch to Compact';
  } else {
    picker.setAttribute('compact', '');
    toggleBtn.textContent = 'Switch to Full';
  }
});
