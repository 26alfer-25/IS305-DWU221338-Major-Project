# UML and System Design
**Student:** Obert MOSES — **Student ID:** 221338

The diagrams are written in **Mermaid**, which GitHub draws automatically when you open this file in the repository. To get a picture for Moodle or a Word document, paste each code block into <https://mermaid.live> and use *Actions → PNG*. These diagrams match the final code in `src/`.

## 1. Use case diagram
```mermaid
flowchart LR
  R([Student / Staff Requester])
  O([Service Officer])
  T([Technician])
  A([System Administrator])

  subgraph SYS[Campus Service Request Management System]
    UC1((Register user))
    UC2((Submit service request))
    UC3((View / search requests))
    UC4((Update own request))
    UC5((Cancel own request))
    UC6((Review request))
    UC7((Assign priority))
    UC8((Assign Technician))
    UC9((Start work))
    UC10((Add progress note))
    UC11((Resolve request))
    UC12((Verify and close request))
    UC13((Filter and sort requests))
    UC14((View audit log))
    UC15((Run management reports))
  end

  R --- UC1 & UC2 & UC3 & UC4 & UC5
  O --- UC3 & UC6 & UC7 & UC8 & UC12 & UC13
  T --- UC3 & UC9 & UC10 & UC11
  A --- UC1 & UC3 & UC14 & UC15
```

## 2. Class diagram
```mermaid
classDiagram
  direction TB

  class User {
    -String userId
    -String firstName
    -String lastName
    -String email
    -String userType
    +getFullName() String
    +validate() boolean
    +displayInfo() String
    +canSubmitRequests() boolean
    +canManageRequests() boolean
    +canWorkOnRequests() boolean
    +canViewAdminData() boolean
    +toData() Object
  }
  class StudentRequester { -String programme  -int yearLevel }
  class StaffRequester { -String department }
  class ServiceOfficer { -String serviceSection  +canManageRequests() }
  class Technician { -String speciality  +canWorkOnRequests() }
  class SystemAdministrator { -String office  +canViewAdminData() }
  User <|-- StudentRequester
  User <|-- StaffRequester
  User <|-- ServiceOfficer
  User <|-- Technician
  User <|-- SystemAdministrator

  class ServiceRequest {
    <<abstract-style>>
    -String requestId
    -User requester
    -String title
    -String description
    -String location
    -String category
    -String priority
    -String status
    -Date dateSubmitted
    -Date dateUpdated
    -User assignedTechnician
    -Array history
    +validate() boolean
    +updateDetails(changes)
    +cancelRequest()
    +transitionTo(status, info)
    +assignPriority(priority, actor)
    +assignTechnician(tech, actor)
    +addProgressNote(note, actor)
    +getHistory() Array
    +getRequestSummary()* String
    +calculatePriorityScore()* int
    +getTargetResolutionHours()* int
    +toData() Object
  }
  class ICTSupportRequest { -deviceType -systemName -faultType -networkImpact }
  class MaintenanceRequest { -building -roomNumber -hazardLevel -equipmentAffected }
  class CleaningRequest { -cleaningArea -hygieneRisk -serviceType -preferredServiceTime }
  class GeneralServiceRequest { -serviceArea }
  ServiceRequest <|-- ICTSupportRequest
  ServiceRequest <|-- MaintenanceRequest
  ServiceRequest <|-- CleaningRequest
  ServiceRequest <|-- GeneralServiceRequest

  class AuditEntry {
    -String auditId
    -String actorId
    -String actorRole
    -String action
    -String requestId
    -String description
    -Date timestamp
    -String outcome
  }

  class ServiceRequestManager {
    -Array users
    -Array requests
    -Array auditLog
    +registerUser(user)
    +submitRequest(request)
    +updateRequest(id, userId, changes)
    +cancelRequest(id, userId)
    +reviewRequest(id, officerId)
    +setRequestPriority(id, officerId, priority)
    +assignTechnician(id, officerId, techId)
    +startWork(id, techId)
    +addProgressNote(id, techId, note)
    +resolveRequest(id, techId)
    +closeRequest(id, officerId)
    +searchRequests(text)
    +filterRequests(criteria)
    +sortByPriority(order)
    +sortByDateSubmitted(order)
    +getAuditLog()
    +restoreState(data)
  }
  class ReportService {
    +requestsByStatus()
    +requestsByCategory()
    +requestsByPriority()
    +urgentRequests()
    +overdueRequests()
    +requestsPerTechnician()
    +completedByTechnician()
    +averageResolutionTime()
    +volumeByLocation()
  }
  class UserFactory { +createUser() +createFromData() }
  class ServiceRequestFactory { +createRequest() +createFromData() }

  class FileRepository { +loadAll() +saveAll(records) +create(record) +findById(id) +update(id, changes) }
  class UserFileRepository { +findByEmail() }
  class ServiceRequestFileRepository { +findByRequester() +findByTechnician() }
  class RequestHistoryFileRepository { +findByRequest() }
  class AuditFileRepository { +findByRequest() +findByActor() }
  FileRepository <|-- UserFileRepository
  FileRepository <|-- ServiceRequestFileRepository
  FileRepository <|-- RequestHistoryFileRepository
  FileRepository <|-- AuditFileRepository

  class DataStore { +loadInto(manager) +saveFrom(manager) }
  class CampusServiceApp { +run() }

  ServiceRequest "many" --> "1" User : requester
  ServiceRequest "many" --> "0..1" User : assignedTechnician
  ServiceRequestManager "1" o-- "many" User
  ServiceRequestManager "1" o-- "many" ServiceRequest
  ServiceRequestManager "1" o-- "many" AuditEntry
  ReportService --> ServiceRequestManager : reads
  CampusServiceApp --> ServiceRequestManager
  CampusServiceApp --> ReportService
  CampusServiceApp --> ServiceRequestFactory
  CampusServiceApp --> UserFactory
  CampusServiceApp --> DataStore
  DataStore --> UserFileRepository
  DataStore --> ServiceRequestFileRepository
  DataStore --> RequestHistoryFileRepository
  DataStore --> AuditFileRepository
  DataStore ..> UserFactory : restores users
  DataStore ..> ServiceRequestFactory : restores requests
  ServiceRequestFactory ..> ServiceRequest : creates
  UserFactory ..> User : creates
```
`*` after a method name means *abstract-style*: the base class throws an error until a subclass overrides it.

## 3. Sequence diagram — submitting a request
```mermaid
sequenceDiagram
  actor Req as Requester
  participant App as CampusServiceApp
  participant Fac as ServiceRequestFactory
  participant SR as ICTSupportRequest
  participant Mgr as ServiceRequestManager
  participant DS as DataStore
  participant Repo as File repositories

  Req->>App: choose 2 (Submit Service Request)
  App->>Req: ask user ID, title, description, location, category, priority, ICT details
  Req-->>App: answers
  App->>Mgr: findUserById(userId)
  Mgr-->>App: User
  App->>Mgr: getNextRequestId()
  Mgr-->>App: "REQ001"
  App->>Fac: createRequest(commonData, specialisedData)
  Fac->>SR: new ICTSupportRequest(...) — super() then validates ICT fields
  SR-->>Fac: request (status Submitted)
  Fac-->>App: request
  App->>Mgr: submitRequest(request)
  Mgr->>SR: validate()
  Mgr->>Mgr: check requester registered, may submit, ID not duplicate
  Mgr->>Mgr: store request + add audit entry "Request Created"
  Mgr-->>App: request
  App->>DS: saveFrom(manager)
  DS->>Repo: saveAll(users, requests, history, audit)
  Repo-->>DS: files written
  App-->>Req: "SUCCESS: Request submitted" + summary
```

## 4. Sequence diagram — assigning a Technician
```mermaid
sequenceDiagram
  actor Off as Service Officer
  participant App as CampusServiceApp
  participant Mgr as ServiceRequestManager
  participant SR as ServiceRequest
  participant DS as DataStore

  Off->>App: Officer Menu → Assign Technician
  App->>Off: ask officer ID, request ID, technician ID
  Off-->>App: answers
  App->>Mgr: assignTechnician(requestId, officerId, technicianId)
  Mgr->>Mgr: find request (NotFoundError if missing)
  Mgr->>Mgr: requireOfficer(officerId) — canManageRequests()?
  alt not a Service Officer
    Mgr-->>App: PermissionError (audited as Rejected)
    App-->>Off: "ERROR: Only a Service Officer can assign Technicians"
  else officer allowed
    Mgr->>Mgr: find technician user
    Mgr->>SR: assignTechnician(technician, officer)
    SR->>SR: technician.canWorkOnRequests()? status Reviewed → Assigned allowed?
    alt invalid transition or not a Technician
      SR-->>Mgr: WorkflowError / ValidationError (nothing changed)
      Mgr-->>App: error (audited as Rejected)
    else valid
      SR->>SR: set assignedTechnician, transitionTo(Assigned), add history entry
      SR-->>Mgr: request
      Mgr->>Mgr: add audit entry "Technician Assigned"
      Mgr-->>App: request
      App->>DS: saveFrom(manager)
      App-->>Off: "SUCCESS: assigned to <technician>"
    end
  end
```

## 5. Sequence diagram — resolving and closing a request
```mermaid
sequenceDiagram
  actor Tech as Technician
  actor Off as Service Officer
  participant App as CampusServiceApp
  participant Mgr as ServiceRequestManager
  participant SR as ServiceRequest
  participant DS as DataStore

  Tech->>App: Technician Menu → Resolve request
  App->>Mgr: resolveRequest(requestId, technicianId, comment)
  Mgr->>Mgr: requireAssignedTechnician(request, technicianId)
  alt not the assigned Technician
    Mgr-->>App: PermissionError (audited as Rejected)
  else assigned Technician
    Mgr->>SR: transitionTo("Resolved", actor, action, comment)
    SR->>SR: check STATUS_TRANSITIONS (In Progress → Resolved)
    SR->>SR: add history entry
    Mgr->>Mgr: add audit entry "Request Resolved"
    Mgr-->>App: request
    App->>DS: saveFrom(manager)
    App-->>Tech: "SUCCESS: Request is now Resolved"
  end

  Off->>App: Officer Menu → Verify and close
  App->>Mgr: closeRequest(requestId, officerId)
  Mgr->>Mgr: requireOfficer(officerId)
  Mgr->>SR: transitionTo("Closed", officer, ...)
  SR->>SR: check transition (Resolved → Closed), add history entry
  Mgr->>Mgr: add audit entry "Request Closed"
  Mgr-->>App: request
  App->>DS: saveFrom(manager)
  App-->>Off: "SUCCESS: Request is now Closed"
```

## 6. Status workflow (state diagram)
```mermaid
stateDiagram-v2
  [*] --> Submitted
  Submitted --> Reviewed : Service Officer reviews
  Submitted --> Cancelled : Requester cancels
  Reviewed --> Assigned : Service Officer assigns Technician
  Assigned --> InProgress : assigned Technician starts
  InProgress --> Resolved : assigned Technician resolves
  Resolved --> Closed : Service Officer verifies
  Closed --> [*]
  Cancelled --> [*]
```
(`InProgress` is shown without a space only because Mermaid state names cannot contain one; the status text in the program is "In Progress".)

## 7. Explanation of the class relationships
- **Inheritance ("is a")**: `StudentRequester`, `StaffRequester`, `ServiceOfficer`, `Technician` and `SystemAdministrator` extend `User`. `ICTSupportRequest`, `MaintenanceRequest`, `CleaningRequest` and `GeneralServiceRequest` extend `ServiceRequest`. The four file repositories extend `FileRepository`.
- **Composition / association ("has a")**: every `ServiceRequest` holds a reference to its requester (a `User`) and, once assigned, to its Technician (a `User`). A request also owns its history array.
- **Aggregation**: `ServiceRequestManager` holds the arrays of users, requests and audit entries.
- **Dependency ("uses")**: `CampusServiceApp` uses the manager, factories, `ReportService` and `DataStore`; it never touches files. The factories create objects; `DataStore` uses the repositories and factories to save and restore data; `ReportService` only reads from the manager.
- **Separation of responsibilities**: menu (`CampusServiceApp`) → rules (`ServiceRequestManager`, `ServiceRequest`) → storage (`DataStore` + repositories).
