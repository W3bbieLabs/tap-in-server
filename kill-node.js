import * as child from "child_process"
let { spawn, exec } = child
import psList from 'ps-list';

/// Core Node.js Utils
export const get_node_process_id = async (file_name) => {
    try {
        const processes = await psList();

        //console.log('List of Node.js processes:');
        for (const process of processes) {
            if (process.name === 'node') {
                let program_name = process.cmd.split(" ")[1]
                if (program_name == file_name) {
                    return { id: process.pid, program_name: program_name }
                }
            }
        }
        return null
    } catch (err) {
        console.error('Error listing processes:', err);
        return null
    }
}

export const start_program = (program_file) => {
    // Arguments to pass to the child process (if needed)
    const scriptArgs = [];

    // Options for the spawn function
    const spawnOptions = {
        stdio: 'pipe', // Capture stdout from the child process
        shell: true,   // Use a shell to execute the command (for cross-platform compatibility)
    };

    // Start the child Node.js process
    const childProcess = spawn('node', [program_file, ...scriptArgs], spawnOptions);

    // Handle stdout data from the child process
    childProcess.stdout.on('data', (data) => {
        console.log(`${data}`);
    });

    // Handle events from the child process
    childProcess.on('exit', (code, signal) => {
        if (code !== null) {
            console.log(`Child process exited with code ${code}`);
        } else if (signal !== null) {
            console.log(`Child process killed with signal ${signal}`);
        }
    });

    childProcess.on('error', (err) => {
        console.error(`Error starting child process: ${err.message}`);
    });
}

export const stop_program = async (file_name) => {
    let pid = await get_node_process_id(file_name)
    if (pid == null) {
        console.log("No program to stop.")
        return
    }
    console.log("=====")
    console.log("Stop Program ", pid.id)
    console.log("=====")

    // Kill the process
    const killCmd = `kill ${pid.id}`;
    exec(killCmd, (killError, killStdout, killStderr) => {
        if (killError) {
            console.log(killError)
            console.log(killStdout)
            return
        } else if (killStderr) {
            console.log(killStderr)
            return
        }
        console.log(killStdout)
    })
}


let main = () => {
    stop_program(process.argv[2])
}

main()