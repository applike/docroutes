/**
 * A single task we aim to do (eventually).
 */
interface ITodoItem {
    /**
     * The thing we want to do.
     */
    item: string;
    /**
     * Date this task was created at.
     */
    created: Date;
    /**
     * If we have a deadline, this is the deadline. Otherwise it is null.
     */
    due: Date | null;
}

/**
 * A server responds with a task containing the id, but a user does not have this id.
 */
export interface ITodoItemWithKey extends ITodoItem {
    /**
     * The id of the entry in the database.
     */
    id: number;
}

export type TodoList = ITodoItem[];

export interface ITodoState {
    items: TodoList;
}

/**
 * Routes for the TODO app.
 *
 * @ExportRoute("/")
 */
export interface ITodoRoutes {
    /**
     * Create a new task.
     */
    "/todo/create": {
        /**
         * We use POST here.
         */
        "POST": {
            authorization: string;
            body: ITodoItem;
            response: {
                /**
                 * The server might respond with the id of the task.
                 */
                201: number;
                /**
                 * But if the server queues the task for insertion, maybe we just get a confirmation of success.
                 */
                202: undefined;
            }
        };
    };
    /**
     * Request a task by id.
     */
    "/todo/:id": {
        "GET": {
            param: {
                /**
                 * The id of the thing we request.
                 */
                id: number;
            };
            query: {
                /**
                 * Only return the result if it is not due already.
                 */
                ifNotDue?: boolean;
            }
            response: {
                /**
                 * The task we wanted.
                 */
                200: ITodoItemWithKey;
                /**
                 * The server does not know this task.
                 */
                404: undefined;
                /**
                 * The task was already due and thus could not be returned.
                 */
                417: undefined;
            }
        };
        "PUT": {
            authorization: string;
            param: {
                /**
                 * The id of the thing we request.
                 */
                id: number;
            };
            body: ITodoItem;
            response: {
                204: undefined;
                404: undefined;
            };
        };
        "DELETE": {
            authorization: string;
            204: undefined;
            401: undefined;
            404: undefined;
        };
    };
    "/todo/list": {
        "GET": {
            response: {
                200: TodoList;
            };
        };
    };
}
