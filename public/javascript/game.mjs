import {createElement, addClass, removeClass} from './helper.mjs';

const username = sessionStorage.getItem('username');

const socket = io('', {query: {username}});

import Room from './room.mjs';

const renderRoom = Room(socket);

if (!username) {
    window.location.replace(`/login`);
}

socket.on('USERNAME_ALREADY_EXISTS', () => {
    sessionStorage.removeItem('username');
    alert('Please choose another username, as it\'s already taken :(');
    window.location.replace(`/login`);
});

socket.on('ROOM_NAME_ALREADY_EXISTS', () => {
    alert('Please choose another room name, as it\'s already taken :(');
})

let activeRoomName = null;

const createRoomCard = ({name, userCount}) => {
    const roomCard = createElement({
        tagName: 'div', className: 'room-card'
    });

    const roomUserCount = createElement({tagName: 'span', className: 'room-users-count'});
    roomUserCount.innerText = `${userCount} users connected`;

    const roomName = createElement({tagName: 'h3', className: 'room-name'});
    roomName.innerText = name;

    const roomJoinBtn = createElement({tagName: 'button', className: 'btn room-join-btn', attributes: {id: name}});
    roomJoinBtn.innerText = 'Join';
    roomJoinBtn.addEventListener('click', ({target: {id: joinRoomName}}) => {
        if (joinRoomName === activeRoomName) {
            return;
        }
        socket.emit('JOIN_ROOM', {roomId: joinRoomName, username});
    });

    roomCard.append(roomUserCount);
    roomCard.append(roomName);
    roomCard.append(roomJoinBtn);

    return roomCard;
};

socket.on('JOIN_ROOM_DONE', ({roomName, users}) => {
    renderRoom({roomName, users});

    // TODO: fix duplicate
    const btn = document.getElementById('back-btn');

    if (btn.getAttribute('listener') !== 'true') {
        btn.addEventListener('click', () => {
            socket.emit('LEAVE_ROOM', roomName);
            activeRoomName = null;
        });
    }

    activeRoomName = roomName;
});

socket.on('BEFORE_START', ({seconds, roomName, users}) => {
    renderRoom({roomName, users});

    const btn = document.getElementById('back-btn');
    addClass(btn, 'non-active');

    const readinessBtn = document.getElementById('readiness-btn');
    addClass(readinessBtn, 'non-active');

    const textContent = document.getElementById('text');
    for (let i = 0; i < seconds; i++) {
        setTimeout(() => textContent.innerText = seconds - i, i * 1000);
    }
});

socket.on('TEXT_ID', async ({textId, seconds}) => {
    const response = await fetch(`http://localhost:3002/game/texts/${textId}`);
    const text = await response.text();

    const textContent = document.getElementById('text');

    setTimeout(() => {
        function highlight(count) {
            const nextCharacter = text.substring(count, count + 1);
            const highlighted = `<span class="entered-text">${text.substring(0, count)}</span>`;
            const nextHighlighted = `<span class="next-character">${nextCharacter}</span>`;
            textContent.innerHTML = highlighted + nextHighlighted + text.substring(count + 1);
        }

        let typedCharactersCount = 0;

        highlight(0);

        gameInput.addEventListener('keyup', e => {
            const typed = e.target.value;
            const subText = text.substring(0, typed.length);
            if (subText === typed) {
                typedCharactersCount = typed.length;
                const progress = 100 * typedCharactersCount / text.length;
                highlight(typedCharactersCount);
                socket.emit('CHARACTER_TYPED', {
                    roomName: activeRoomName,
                    username,
                    progress
                });
            }
        });
    }, seconds * 1000);

    setTimeout(() => {
        const timer = document.querySelector('.timer');
        addClass(timer, 'active');
        removeClass(timer, 'non-active');
        for (let i = 0; i <= 60; i++) {
            setTimeout(() => timer.innerText = `${60 - i} seconds left`, i * 1000);
        }
    }, seconds * 1000);

    const gameInput = createElement({tagName: 'input', attributes: {id: 'game-input'}});

    document.getElementById('text-container').append(gameInput);
});

socket.on('ROOM_UPDATE_USERS', ({roomName, users}) => {
    const userListContainer = document.getElementById('user-list-container');
    userListContainer.innerText = '';

    users.forEach(u => {
        const userInfo = createElement({tagName: 'div', className: 'user-info'});

        const status = createElement({tagName: 'span', className: 'status'});
        addClass(status, u.status ? 'ready-status' : 'not-ready-status');

        const usernameEl = createElement({tagName: 'span', className: 'user-name'});
        usernameEl.innerText = u.username;
        usernameEl.innerText += username === u.username ? ' (You)' : '';

        const progressBarContainer = createElement({tagName: 'div', className: 'progress-bar-container'});
        const progressBar = createElement({tagName: 'span', className: 'progress-bar'});
        progressBar.style.width = `${2.5 * u.progress}px`;
        if (u.progress === 100) {
            addClass(progressBar, 'complete')
        }

        progressBarContainer.append(progressBar);

        userInfo.append(status);
        userInfo.append(usernameEl);
        userInfo.append(progressBarContainer);

        userListContainer.append(userInfo);
    });

    const currUser = users.find(u => u.username === username);

    const btnReadiness = document.getElementById('readiness-btn');
    btnReadiness.innerText = currUser.status ? 'ready' : 'not ready';
});

socket.on('FINISH_GAME', users => {
    document.getElementById('game-input').style.disabled = true;
    const timerEl = document.getElementsByClassName('timer')[0];
    removeClass(timerEl, 'active');
    addClass(timerEl, 'non-active');
    let msg = '';
    const topUsers = users.map(u => u.username);
    topUsers.forEach((u, idx) => {
        msg += `'${u}' user takes ${idx + 1} place!\n`;
    });
    alert(msg);
    debugger;
    window.location.replace('/game');
});

socket.on('UPDATE_ROOMS', rooms => {
    if (!activeRoomName) {
        renderRoomsContainer();
        const roomsPage = document.getElementById('rooms-page');

        const allRooms = rooms.filter(r => !r.isGame).map(createRoomCard);
        roomsPage.innerHTML = "";
        roomsPage.append(...allRooms);
    }
});

const renderRoomsContainer = () => {
    const body = document.getElementsByTagName('body')[0];
    body.innerText = '';

    const root = createElement({tagName: 'div', attributes: {id: 'root'}});

    const rootHeaderContainer = createElement({tagName: 'div', attributes: {id: 'root-header-container'}});

    const header = createElement({tagName: 'h1'});
    header.innerText = 'Join Or Create New';

    const btn = createElement({tagName: 'button', className: 'btn', attributes: {id: 'room-create-btn'}});
    btn.innerText = 'Create Room';

    rootHeaderContainer.append(header);
    rootHeaderContainer.append(btn);

    root.append(rootHeaderContainer);
    root.append(createElement({tagName: 'div', attributes: {id: 'rooms-page'}}));

    body.append(root);

    document.getElementById('room-create-btn').addEventListener('click', () => {
        const newRoomName = prompt('Enter a root name');
        socket.emit('CREATE_ROOM', newRoomName);
    })

};


renderRoomsContainer();
