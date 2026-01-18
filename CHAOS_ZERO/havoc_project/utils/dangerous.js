
function executeChaos(input) {
    eval(input); // SECURITY RISK
    document.write(input); // XSS RISK
}
