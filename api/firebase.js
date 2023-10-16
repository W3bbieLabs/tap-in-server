import admin from 'firebase-admin'
import serviceAccount from './key.json' assert {type: 'json'}

export const FBManager = class {
    constructor(databaseURL) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
        });

        this.game_listeners = {}

        this.db = admin.database();

        this.create_global_listener("rooms", this.system_events.bind(this))

        this.create_child_added_listener("rooms", this.handle_game_created.bind(this))

        this.create_child_removed_listener("rooms", this.handle_game_destroyed.bind(this))

        //this.read_data()
    }

    room_code_from_snapshot(snapshot) {
        return snapshot.ref.toString().split("/")[4]
    }

    remove_listener(path) {
        this.db.ref(path).off();
    }

    system_events(snapshot) {
        //console.log("Log", snapshot.val())
        //console.log(snapshot.ref.toString())
        //console.log(snapshot.val())
    }

    init_game(room_code) {
        console.log("init!", room_code)
    }

    set_room_callback(room_code, cb) {
        this.db.ref(`rooms/${room_code}`).once("value", (snapshot) => {
            if (snapshot.val() !== null) {
                //console.log(snapshot.val())
                cb()
            } else {
                console.log("skipping callback")
            }
        });
    }

    check_room_state(snapshot, room_code) {
        let payload = snapshot.val()
        if (payload) {
            let { state, count, start } = payload
            if (count && state) {

                // Start Game 
                if ((parseInt(count) > 1) && (state == "WAITING")) {
                    //console.log(room_code, count, state)
                    this.db.ref(`rooms/${room_code}/state`).set("READY")

                    // Check to see if room is still valid before writing new state
                    setTimeout(() => {
                        this.set_room_callback(room_code, () => {
                            this.db.ref(`rooms/${room_code}/state`).set("SET")
                        })
                    }, 5000)

                    setTimeout(() => {
                        this.set_room_callback(room_code, () => {
                            this.db.ref(`rooms/${room_code}/start`).set(Date.now())
                            this.db.ref(`rooms/${room_code}/state`).set("GO")
                        })
                    }, 10000)

                    setTimeout(() => {
                        this.set_room_callback(room_code, () => {
                            this.db.ref(`rooms/${room_code}/state`).set("WAITING")
                        })
                    }, 20000)
                }

                // Get Score on tap
                if ((state == "GO")) {
                    for (let player in payload.players) {
                        if (payload.players[player].server_touch) {
                            let player_elapsed = (payload.players[player].server_touch - start) / 1000
                            //console.log(player, player_elapsed)
                            this.db.ref(`rooms/${room_code}/players/${player}/result`).set(player_elapsed)
                        }

                    }
                }
            }
        }
    }


    handle_game_created(main_snapshot) {
        console.log("game created", main_snapshot.val())
        let room_code = this.room_code_from_snapshot(main_snapshot)
        //console.log(this.game_code_from_snapshot(snapshot))

        this.db.ref(`rooms/${room_code}/state`).set("WAITING")

        // create general room listener
        this.create_global_listener(`rooms/${room_code}/`, (snapshot) => this.check_room_state(snapshot, room_code))

        // Create listener for new room players
        this.create_child_added_listener(`rooms/${room_code}/players`, (snapshot) => {
            console.log("-------")
            console.log("player joined room: ", room_code)

            let payload = snapshot.val()
            console.log(payload)

            // Create touch listener 
            this.create_global_listener(`rooms/${room_code}/players/${payload.player_id}/touch/`, (snapshot) => {
                console.log("TOUCH!", room_code, payload.player_id, snapshot.val())

                // Set server time
                this.db.ref(`rooms/${room_code}/players/${payload.player_id}/server_touch`).set(Date.now())
            })

        })

        this.create_child_removed_listener(`rooms/${room_code}/players`, (snapshot) => {
            console.log("-------")
            console.log("player left room: ", room_code)
            let payload = snapshot.val()
            console.log(payload)

            // remove touch listener
            this.remove_listener(`rooms/${room_code}/players/${payload.player_id}/touch/`)
        })
    }

    handle_game_destroyed(snapshot) {
        let room_code = this.room_code_from_snapshot(snapshot)
        console.log("game destroyed", room_code, snapshot.val())
        // Remove listner for new room
        this.remove_listener(`rooms/${room_code}`)
        this.remove_listener(`rooms/${room_code}/players`)
        //this.remove_listener(`rooms/${room_code}/count`)
    }

    handle_player_joined(snapshot) {
        console.log("player joined")
        console.log(snapshot)
    }

    create_child_added_listener(path, cb) {
        var ref = this.db.ref(path);
        ref.on("child_added", (snapshot) => cb(snapshot));
    }

    create_child_removed_listener(path, cb) {
        var ref = this.db.ref(path);
        ref.on("child_removed", (snapshot) => cb(snapshot));
    }

    create_global_listener(path, cb) {
        var ref = this.db.ref(path);
        ref.on("value", (snapshot) => cb(snapshot));
    }

    read_data() {
        var ref = this.db.ref();
        ref.on("value", (snapshot) => console.log(snapshot.val()));
    }

    push_data(id, payload) {
        const payloadRef = this.db.ref('client/' + id);
        payloadRef.set(payload)
    }
}