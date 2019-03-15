# ITodoRoutes

- Prefix for all routes: `/`
- Routes for the TODO app.

[TOC]

## `/todo/create`

Create a new task.

### POST

- We use POST here.
- Authorization:

  ```ts
  string
  ```

- Body:

  ```ts
  {
    item:    string;
    created: Date;
    status:  "open" | "started" | "onHold";
    due:     Date | null;
  } /* A single task we aim to do (eventually). */
  ```

- Response:

  - `201`: The server might respond with the id of the task.

    ```ts
    number
    ```

  - `202`: But if the server queues the task for insertion, maybe we just get a confirmation of success.Empty response

## `/todo/:id`

Request a task by id.

### GET

- Parameters:

  - `id`: The id of the thing we request.

    ```ts
    number
    ```

- Query-Parameters:

  - `ifNotDue` (optional): Only return the result if it is not due already.

    ```ts
    boolean
    ```

- Response:

  - `200`: The task we wanted.

    ```ts
    {
      id:      number;
      item:    string;
      created: Date;
      status:  "open" | "started" | "onHold";
      due:     Date | null;
    } /* A server responds with a task containing the id, but a user does not have this id. */
    ```

  - `404`: The server does not know this task.Empty response

  - `417`: The task was already due and thus could not be returned.Empty response

### PUT

- Authorization:

  ```ts
  string
  ```

- Body:

  ```ts
  {
    item:    string;
    created: Date;
    status:  "open" | "started" | "onHold";
    due:     Date | null;
  } /* A single task we aim to do (eventually). */
  ```

- Parameters:

  - `id`: The id of the thing we request.

    ```ts
    number
    ```

- Response:

  - `204`: Empty response

  - `404`: Empty response

### DELETE

- Authorization:

  ```ts
  string
  ```

- Response:

  - `204`: Empty response

  - `401`: Empty response

  - `404`: Empty response

## `/todo/list`

### GET

- Response:

  - `200`:

    ```ts
    Array<{
      item:    string;
      created: Date;
      status:  "open" | "started" | "onHold";
      due:     Date | null;
    } /* A single task we aim to do (eventually). */>
    ```

