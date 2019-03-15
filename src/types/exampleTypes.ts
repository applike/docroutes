/**
 * A single task we aim to do (eventually).
 */
export interface ITodoItem {
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
