const target = document.getElementById('sample-target');
if (target) {
    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 8px 16px; display: flex; gap: 8px; align-items: center;';
    controls.innerHTML = `
        <button id="demo-disconnect" style="padding: 6px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">Disconnect</button>
        <button id="demo-reconnect" style="padding: 6px 16px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer;" disabled>Reconnect</button>
        <span id="demo-status" style="padding: 6px; color: #16a34a;">● Connected</span>
    `;
    target.prepend(controls);
}
