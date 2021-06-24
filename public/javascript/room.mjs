import {createElement, addClass} from './helper.mjs';

export default socket =>
    function renderRoom({roomName, users}) {
        const body = document.getElementsByTagName('body')[0];
        body.innerText = '';

        const username = sessionStorage.getItem('username');
        const currUser = users.find(u => u.username === username);

        // Left side
        const rootContainer = createElement({
            tagName: 'div',
            className: 'full-screen',
            attributes: {id: 'root-container'}
        });

        const leftSide = createElement({tagName: 'div', className: 'left-side'});

        const header = createElement({tagName: 'h1'});
        header.innerText = roomName;

        const btn = createElement({tagName: 'button', className: 'btn', attributes: {id: 'back-btn'}});
        btn.innerText = 'Back To Rooms';

        const userListContainer = createElement({tagName: 'div', attributes: {id: 'user-list-container'}});

        users.forEach(u => {
            const userInfo = createElement({tagName: 'div', className: 'user-info'});

            const status = createElement({tagName: 'span', className: 'status'});
            addClass(status, u.status ? 'ready-status' : 'not-ready-status');

            const username = createElement({tagName: 'span', className: 'user-name'});
            username.innerText = u.username;
            username.innerText += currUser.username === u.username ? ' (You)' : '';

            const progressBarContainer = createElement({tagName: 'div', className: 'progress-bar-container'});
            const progressBar = createElement({tagName: 'span', className: 'progress-bar'});

            progressBarContainer.append(progressBar);

            userInfo.append(status);
            userInfo.append(username);
            userInfo.append(progressBarContainer);

            userListContainer.append(userInfo);
        });

        leftSide.append(header);
        leftSide.append(btn);
        leftSide.append(userListContainer);

        rootContainer.append(leftSide);

        // Right side
        const rightSide = createElement({tagName: 'div', className: 'right-side'});
        const textContainer = createElement({
            tagName: 'div',
            className: 'flex-centered',
            attributes: {id: 'text-container'}
        });
        const btnReadiness = createElement({tagName: 'button', className: 'btn', attributes: {id: 'readiness-btn'}});
        btnReadiness.innerText = currUser.status ? 'ready' : 'not ready';
        btnReadiness.addEventListener('click', () => {
            socket.emit('READY_TOGGLE', roomName);
        });

        const timer = createElement({tagName: 'span', className: 'timer'});
        addClass(timer, 'non-active');

        const textContent = createElement({tagName: 'p', attributes: {id: 'text'}});

        textContainer.append(btnReadiness);
        textContainer.append(timer);
        textContainer.append(textContent);

        rightSide.append(textContainer);

        rootContainer.append(rightSide);

        body.append(rootContainer);
    };
