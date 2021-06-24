import * as config from "./config";
import data from "../data";

const users = new Set();
const rooms = [
    /*  {name: 'Room #1', userCount: 3},
        {name: 'Room #2', userCount: 1},
        {name: 'Room #3', userCount: 7},*/
]; // for UI renders
const roomsMap = new Map(); //key -> room name, value -> { users: [{id: string, username: string, status: 'ready'}] }

const getCurrentRoomId = socket => Object.keys(socket.rooms).find(roomId => roomsMap.has(roomId));

export default io => {
    io.on('connection', socket => {
            // Check username
            const username = socket.handshake.query.username;

            if (users.has(username)) {
                socket.emit('USERNAME_ALREADY_EXISTS');
            }

            users.add(username);

            socket.emit('UPDATE_ROOMS', rooms);

            socket.on('CREATE_ROOM', newRoomName => {
                const isNameTaken = roomsMap.has(newRoomName);
                if (isNameTaken) {
                    socket.emit('ROOM_NAME_ALREADY_EXISTS');
                    return;
                }

                const prevRoomId = getCurrentRoomId(socket);
                if (prevRoomId) {
                    socket.leave(prevRoomId);
                    // TODO: fix duplicate
                    let updatedRooms = rooms.map(r => {
                        if (r.name === prevRoomId) {
                            r.userCount--;
                        }
                        return r;

                    });
                    io.emit('UPDATE_ROOMS', updatedRooms);
                }

                socket.join(newRoomName, () => {
                    rooms.push({name: newRoomName, userCount: 1});
                    roomsMap.set(newRoomName, {users: [{id: socket.id, status: false, username, progress: 0}]});
                    io.emit('UPDATE_ROOMS', rooms);
                    socket.emit('JOIN_ROOM_DONE', {roomName: newRoomName, users: roomsMap.get(newRoomName).users});
                });
            });

            socket.on('JOIN_ROOM', ({roomId, username}) => {
                const roomUsers = roomsMap.get(roomId)?.users;
                if (roomUsers?.length === config.MAXIMUM_USERS_FOR_ONE_ROOM) {
                    return;
                }

                const prevRoomId = getCurrentRoomId(socket);
                if (prevRoomId === roomId) {
                    socket.emit('JOIN_ROOM_DONE', {roomName: roomId, users: roomsMap.get(roomId)});
                    return;
                }

                if (prevRoomId) {
                    const prevRoom = roomsMap.get(prevRoomId);
                    const updatedUsers = prevRoom.users
                        .filter(u => u.id !== socket.id);
                    roomsMap.set(prevRoomId, {users: updatedUsers});

                    socket.leave(prevRoomId);
                    updatedUsers.forEach(u => {
                        io.to(u.id).emit('ROOM_UPDATE_USERS', updatedUsers);
                    });

                }

                const users = roomsMap.get(roomId).users;
                const updatedUsers = [...users, {id: socket.id, status: false, username, progress: 0}];
                roomsMap.set(roomId, {users: updatedUsers});

                socket.join(roomId, () => {
                    socket.emit('JOIN_ROOM_DONE', {roomName: roomId, users: updatedUsers});
                    users.forEach(u => {
                        io.to(u.id).emit('ROOM_UPDATE_USERS', {users: updatedUsers, roomName: roomId});
                    });

                    rooms.forEach(r => {
                        if (r.name === roomId) {
                            r.userCount++;
                        }
                    });

                    io.emit('UPDATE_ROOMS', rooms);
                });
            });

            socket.on('LEAVE_ROOM', roomName => {
                const room = roomsMap.get(roomName);
                const {username} = room.users.find(u => u.id === socket.id);

                socket.leave(roomName);

                const updatedUsers = room.users
                    .filter(u => u.id !== socket.id);

                roomsMap.set(roomName, {users: updatedUsers});

                let idx = null;
                rooms.forEach((r, i) => {
                    if (r.name === roomName) {
                        r.userCount--;
                        if (!r.userCount)
                            idx = i;
                    }
                });

                if (idx !== null) {
                    rooms.splice(idx, 1);
                }
                // TODO: fix duplicate
                let isReadyToPlay = true;
                for (const user of updatedUsers) {
                    if (!user.status || users.length <= 1) {
                        isReadyToPlay = false;
                    }
                }
                if (isReadyToPlay) {
                    rooms.forEach(r => {
                        if (r.name === roomName) {
                            r.isGame = true;
                        }
                    });
                }
                const textId = Math.floor(Math.random() * data.texts.length);
                updatedUsers.forEach(u => {
                    io.to(u.id).emit('ROOM_UPDATE_USERS', {users: updatedUsers, roomName});
                    if (isReadyToPlay) {
                        setTimeout(() => {
                            const topUsers = roomsMap.get(roomName).users
                                .slice()
                                .sort((u1, u2) => {
                                    if (u1.progress === u2.progress) {
                                        return u1.lastTypedCh < u2.lastTypedCh ? -1 : 1;
                                    }
                                    return u2.progress - u1.progress;
                                })
                                .slice(0, 3);

                            io.to(u.id).emit('FINISH_GAME', topUsers);
                        }, (config.SECONDS_TIMER_BEFORE_START_GAME + config.SECONDS_FOR_GAME) * 1000);
                        io.to(u.id).emit('TEXT_ID', {seconds: config.SECONDS_TIMER_BEFORE_START_GAME, textId});
                        io.to(u.id).emit('BEFORE_START', {
                            seconds: config.SECONDS_TIMER_BEFORE_START_GAME,
                            users: updatedUsers,
                            roomName
                        });
                    }
                });
                io.emit('UPDATE_ROOMS', rooms);
                users.delete(username);
            });

            socket.on('READY_TOGGLE', roomName => {
                const users = roomsMap.get(roomName).users;

                let userStatus;

                const updatedUsers = users.map(u => {
                    if (u.id === socket.id) {
                        userStatus = u.status;
                        return {...u, status: !userStatus};
                    }
                    return u;
                });

                roomsMap.set(roomName, {users: updatedUsers});

                let isReadyToPlay = true;
                for (const user of roomsMap.get(roomName).users) {
                    if (!user.status || updatedUsers.length <= 1) {
                        isReadyToPlay = false;
                    }
                }

                if (isReadyToPlay) {
                    const updatedRooms = rooms.map(r => {
                        if (r.name === roomName) {
                            r.isGame = true;
                        }
                        return r;

                    });
                    io.emit('UPDATE_ROOMS', updatedRooms);
                }

                const textId = Math.floor(Math.random() * data.texts.length);
                users.forEach(u => {
                    io.to(u.id).emit('ROOM_UPDATE_USERS', {users: updatedUsers, roomName});
                    if (isReadyToPlay) {
                        setTimeout(() => {
                            const topUsers = roomsMap.get(roomName).users
                                .slice()
                                .sort((u1, u2) => {
                                    if (u1.progress === u2.progress) {
                                        return u1.lastTypedCh < u2.lastTypedCh ? -1 : 1;
                                    }
                                    return u2.progress - u1.progress;
                                })
                                .slice(0, 3);

                            io.to(u.id).emit('FINISH_GAME', topUsers);
                        }, (config.SECONDS_TIMER_BEFORE_START_GAME + config.SECONDS_FOR_GAME) * 1000);
                        io.to(u.id).emit('TEXT_ID', {seconds: config.SECONDS_TIMER_BEFORE_START_GAME, textId});
                        io.to(u.id).emit('BEFORE_START', {
                            seconds: config.SECONDS_TIMER_BEFORE_START_GAME,
                            users: updatedUsers,
                            roomName
                        });
                    }
                });

            });

            socket.on('CHARACTER_TYPED', ({roomName, username, progress}) => {
                const users = roomsMap.get(roomName).users;

                const updatedUsers = users.map(u => {
                    if (u.id === socket.id) {
                        return {...u, progress, lastTypedCh: Date.now()};
                    }
                    return u;
                });

                roomsMap.set(roomName, {users: updatedUsers});

                users.forEach(u => {
                    io.to(u.id).emit('ROOM_UPDATE_USERS', {users: updatedUsers, roomName});
                });
            });

            socket.on('disconnecting', () => {
                // Leave room
                const roomName = getCurrentRoomId(socket);
                const room = roomsMap.get(roomName);
                const {username} = room?.users.find(u => u.id === socket.id);

                if (!roomName || !room) {
                    return;
                }

                // TODO: fix duplicate
                socket.leave(roomName);

                const updatedUsers = room.users
                    .filter(u => u.id !== socket.id);

                roomsMap.set(roomName, {users: updatedUsers});

                let idx = null;
                rooms.forEach((r, i) => {
                    if (r.name === roomName) {
                        r.userCount--;
                        if (!r.userCount)
                            idx = i;
                    }
                });

                if (idx !== null) {
                    rooms.splice(idx, 1);
                }
                // TODO: fix duplicate
                let isReadyToPlay = true;
                for (const user of updatedUsers) {
                    if (!user.status || updatedUsers.length <= 1) {
                        isReadyToPlay = false;
                    }
                }
                if (isReadyToPlay) {
                    rooms.forEach(r => {
                        if (r.name === roomName) {
                            r.isGame = true;
                        }
                    });
                }
                const textId = Math.floor(Math.random() * data.texts.length);
                updatedUsers.forEach(u => {
                    io.to(u.id).emit('ROOM_UPDATE_USERS', {users: updatedUsers, roomName});
                    if (isReadyToPlay) {
                        setTimeout(() => {
                            const topUsers = roomsMap.get(roomName).users
                                .slice()
                                .sort((u1, u2) => {
                                    if (u1.progress === u2.progress) {
                                        return u1.lastTypedCh < u2.lastTypedCh ? -1 : 1;
                                    }
                                    return u2.progress - u1.progress;
                                })
                                .slice(0, 3);

                            io.to(u.id).emit('FINISH_GAME', topUsers);
                        }, (config.SECONDS_TIMER_BEFORE_START_GAME + config.SECONDS_FOR_GAME) * 1000);
                        io.to(u.id).emit('TEXT_ID', {seconds: config.SECONDS_TIMER_BEFORE_START_GAME, textId});
                        io.to(u.id).emit('BEFORE_START', {
                            seconds: config.SECONDS_TIMER_BEFORE_START_GAME,
                            users: updatedUsers,
                            roomName
                        });
                    }
                });
                users.delete(username);
                io.emit('UPDATE_ROOMS', rooms);
            })
        }
    );
};
