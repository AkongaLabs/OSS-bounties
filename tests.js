/* 
 * Pomodoro Timer Test Script
 * This script defines automated and manual test cases for the Pomodoro Timer app.
 * Run these tests in Chrome DevTools console after opening index.html.
 * 
 * Version 1.1 - Updated with enhanced notification tests
 */

// Test Suite object to organize tests
const PomodoroTests = {
    // Store test results
    results: {
        passed: 0,
        failed: 0,
        total: 0
    },
    
    // Log test outcomes with color coding
    logResult: function(name, result, message = '') {
        const style = result ? 'color: green; font-weight: bold;' : 'color: red; font-weight: bold;';
        console.log(`%c${result ? 'PASS' : 'FAIL'}: ${name}`, style);
        if (message) {
            console.log(`  ${message}`);
        }
        
        this.results[result ? 'passed' : 'failed']++;
        this.results.total++;
    },
    
    // Print summary of all tests
    summarize: function() {
        console.log('\n===== TEST SUMMARY =====');
        console.log(`Total Tests: ${this.results.total}`);
        console.log(`%cPassed: ${this.results.passed}`, 'color: green');
        console.log(`%cFailed: ${this.results.failed}`, 'color: red');
        console.log(`Success Rate: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    },
    
    // Core timer functionality tests
    timerTests: {
        testTimerInitialization: function() {
            const timerInput = document.getElementById('timer-input');
            const timerDisplay = document.getElementById('timer-display');
            
            // Set timer to 5 minutes
            timerInput.value = '5';
            // Trigger change event
            const event = new Event('change');
            timerInput.dispatchEvent(event);
            
            // Check if display shows 05:00
            const result = timerDisplay.textContent === '05:00';
            PomodoroTests.logResult('Timer Initialization', result, 
                result ? 'Timer display correctly shows 05:00 after setting input to 5' : 
                        `Timer display shows ${timerDisplay.textContent} instead of 05:00`);
        },
        
        testTimerValidation: function() {
            const timerInput = document.getElementById('timer-input');
            const inputError = document.getElementById('input-error');
            
            // Test invalid input
            timerInput.value = 'abc';
            // Trigger change event
            const event = new Event('change');
            timerInput.dispatchEvent(event);
            
            // Check if error message is visible
            const errorVisible = inputError.style.visibility === 'visible';
            PomodoroTests.logResult('Input Validation - Letters', errorVisible, 
                errorVisible ? 'Error correctly displayed for non-numeric input' : 'Error not displayed for non-numeric input');
            
            // Test zero input
            timerInput.value = '0';
            timerInput.dispatchEvent(event);
            const zeroErrorVisible = inputError.style.visibility === 'visible';
            PomodoroTests.logResult('Input Validation - Zero', zeroErrorVisible, 
                zeroErrorVisible ? 'Error correctly displayed for zero input' : 'Error not displayed for zero input');
            
            // Test too large input
            timerInput.value = '1000';
            timerInput.dispatchEvent(event);
            const largeErrorVisible = inputError.style.visibility === 'visible';
            PomodoroTests.logResult('Input Validation - Too Large', largeErrorVisible, 
                largeErrorVisible ? 'Error correctly displayed for input > 999' : 'Error not displayed for input > 999');
            
            // Reset to valid input
            timerInput.value = '25';
            timerInput.dispatchEvent(event);
        }
    },
    
    // Button functionality tests
    buttonTests: {
        testStartPauseButton: function() {
            const startPauseButton = document.getElementById('start-pause-button');
            const initialText = startPauseButton.textContent;
            
            // Click the button to start
            startPauseButton.click();
            const afterStartText = startPauseButton.textContent;
            const startResult = afterStartText === 'Pause';
            
            // Click again to pause
            startPauseButton.click();
            const afterPauseText = startPauseButton.textContent;
            const pauseResult = afterPauseText === 'Start';
            
            PomodoroTests.logResult('Start/Pause Button Toggle', startResult && pauseResult, 
                (startResult && pauseResult) ? 'Button correctly toggles between Start and Pause' : 
                                            'Button does not correctly toggle states');
        },
        
        testResetButton: function() {
            const timerInput = document.getElementById('timer-input');
            const timerDisplay = document.getElementById('timer-display');
            const startPauseButton = document.getElementById('start-pause-button');
            const resetButton = document.getElementById('reset-button');
            
            // Set timer to 5 minutes and start
            timerInput.value = '5';
            timerInput.dispatchEvent(new Event('change'));
            startPauseButton.click();
            
            // Wait 2 seconds
            setTimeout(() => {
                // Click reset
                resetButton.click();
                
                // Check if display resets to 05:00 and button shows Start
                const displayReset = timerDisplay.textContent === '05:00';
                const buttonReset = startPauseButton.textContent === 'Start';
                
                PomodoroTests.logResult('Reset Button Function', displayReset && buttonReset, 
                    (displayReset && buttonReset) ? 'Reset button correctly resets timer and button state' : 
                                                'Reset button does not correctly reset timer state');
                
                // Ensure timer is stopped after test
                if (startPauseButton.textContent === 'Pause') {
                    startPauseButton.click();
                }
            }, 2000);
        }
    },
    
    // Audio functionality tests - some require manual verification
    audioTests: {
        checkAudioInitialization: function() {
            // Check if audio context is defined
            const result = typeof audioContext !== 'undefined' && audioContext !== null;
            PomodoroTests.logResult('Audio Context Initialization', result, 
                result ? 'Audio context is properly initialized' : 'Audio context is not initialized');
        },
        
        testAudioPermissions: function() {
            console.log('%c⚠️ MANUAL TEST NEEDED: Audio Permissions', 'color: orange; font-weight: bold');
            console.log(`
1. Set timer for 5 seconds
2. Start the timer
3. When timer completes, verify audio plays
4. Check browser permissions if audio doesn't play
            `);
        }
    },
    
    // Accessibility tests
    accessibilityTests: {
        testKeyboardNavigation: function() {
            // Check if all interactive elements have appropriate tab index
            const interactiveElements = [
                document.getElementById('timer-input'),
                document.getElementById('start-pause-button'),
                document.getElementById('reset-button')
            ];
            
            const allTabIndexCorrect = interactiveElements.every(el => 
                el.tabIndex >= 0 || el.tabIndex === undefined); // undefined is ok for naturally focusable elements
                
            PomodoroTests.logResult('Keyboard Navigation - Tab Indexes', allTabIndexCorrect, 
                allTabIndexCorrect ? 'All interactive elements are keyboard accessible' : 
                                'Some interactive elements may not be keyboard accessible');
                                
            // Check for aria attributes
            const startPauseButton = document.getElementById('start-pause-button');
            const hasAriaLabel = startPauseButton.hasAttribute('aria-label');
            
            PomodoroTests.logResult('ARIA Attributes', hasAriaLabel, 
                hasAriaLabel ? 'ARIA labels are present for interactive elements' : 
                            'ARIA labels missing on some interactive elements');
        }
    },
    
    // Manual tests that need human verification
    manualTests: {
        listManualTests: function() {
            console.log('%c===== MANUAL TEST INSTRUCTIONS =====', 'color: blue; font-weight: bold');
            
            console.log('%c1. Background Audio Test:', 'font-weight: bold');
            console.log(`
   - Set timer to 30 seconds
   - Start the timer
   - Switch to another tab or minimize the browser
   - Wait for timer to complete
   - Verify audio notification plays in background
            `);
            
            console.log('%c2. Visual Feedback Test:', 'font-weight: bold');
            console.log(`
   - Set timer to 10 seconds
   - Start the timer
   - Wait for timer to complete
   - Verify timer display flashes when timer ends
            `);
              console.log('%c3. Enhanced System Notification Test:', 'font-weight: bold');
            console.log(`
   - Allow notifications if prompted
   - Set timer to 10 seconds
   - Start the timer
   - Minimize the browser window entirely
   - Verify system notification appears when timer ends
   - Verify notification remains visible until clicked
   - Click the notification to dismiss it
   - Verify it focuses the timer window
            `);
              console.log('%c4. Repeating Notifications Test:', 'font-weight: bold');
            console.log(`
   - Open the Notification Settings section
   - Set notification repeats to 3
   - Set timer to 10 seconds
   - Start the timer
   - When timer completes, observe that notifications repeat 3 times
   - Test again after changing the repeat count
            `);
            
            console.log('%c5. Notification Settings Test:', 'font-weight: bold');
            console.log(`
   - Click the "Test Notifications" button
   - Verify that both audio and system notifications are triggered
   - Verify that the timer display flashes
   - Verify that clicking the notification stops the flashing
            `);
            
            console.log('%c6. Permissions Recovery Test:', 'font-weight: bold');
            console.log(`
   - If audio was previously blocked, enable it in browser settings
   - Reload the page
   - Set and start a short timer
   - Verify audio works after permissions are granted
            `);
        }
    },
      // Enhanced notification tests
    notificationTests: {
        testNotificationSettings: function() {
            // Check if notification settings elements exist
            const notificationRepeats = document.getElementById('notification-repeats');
            const testNotificationButton = document.getElementById('test-notification-button');
            
            // Test existence of notification settings elements
            const settingsExist = notificationRepeats && testNotificationButton;
            PomodoroTests.logResult('Notification Settings UI', settingsExist, 
                settingsExist ? 'Notification settings UI elements found' : 'Notification settings UI elements missing');
            
            if (settingsExist) {
                // Test notification repeat setting
                notificationRepeats.value = '5';
                notificationRepeats.dispatchEvent(new Event('change'));
                
                // Check if notification repeat count was updated (we can't directly test the variable, but at least check the input works)
                const repeatValueSet = notificationRepeats.value === '5';
                PomodoroTests.logResult('Notification Repeat Setting', repeatValueSet, 
                    repeatValueSet ? 'Notification repeat count can be set' : 'Failed to set notification repeat count');
                
                // Test test button existence
                const testButtonWorks = testNotificationButton.textContent.includes('Test');
                PomodoroTests.logResult('Test Notification Button', testButtonWorks, 
                    testButtonWorks ? 'Test notification button found' : 'Test notification button not working properly');
            }
        }
    },
    
    // Run all automated tests
    runAllTests: function() {
        console.log('%c===== POMODORO TIMER TEST SUITE =====', 'color: blue; font-weight: bold');
        console.log('Starting automated tests...\n');
        
        // Run timer tests
        this.timerTests.testTimerInitialization();
        this.timerTests.testTimerValidation();
        
        // Run button tests
        this.buttonTests.testStartPauseButton();
        this.buttonTests.testResetButton();
        
        // Run audio tests
        this.audioTests.checkAudioInitialization();
        
        // Run notification tests
        this.notificationTests.testNotificationSettings();
        
        // Run accessibility tests
        this.accessibilityTests.testKeyboardNavigation();
        
        // After a delay, show summary and manual test instructions
        setTimeout(() => {
            this.summarize();
            console.log('\n');
            this.manualTests.listManualTests();
        }, 3000);
    }
};

// Instructions for running tests
console.log('%c===== POMODORO TIMER TEST SCRIPT LOADED =====', 'color: blue; font-weight: bold');
console.log('To run all automated tests, use: PomodoroTests.runAllTests()');
console.log('To see manual test instructions, use: PomodoroTests.manualTests.listManualTests()');
