
/* global app */
app.controller("sapf", ["$scope", "$http", "$timeout", function($scope, $http, $timeout) {
  $scope.data = {
    matricula: "",
    campus: "",
    student_name: "",
    parent_name: "",
    parent_email: "",
    phone_number: "",
    reason: "",
    is_complaint: false
  };
  $scope.state = {
    loading: false,
    submitting: false,
    error: "",
    success: "",
    fetched: false
  };

  const BASE = "https://sapf.casitaapps.com";

  function clearMessages() {
    $scope.state.error = "";
    $scope.state.success = "";
  }

  $scope.init = function(matricula) {
    clearMessages();
    if (matricula) {
      $scope.data.matricula = String(matricula).trim().toUpperCase();
    } else if (window && window.PARENT_MATRICULA) {
      $scope.data.matricula = String(window.PARENT_MATRICULA).trim().toUpperCase();
    }
    if ($scope.data.matricula) {
      $scope.fetchByMatricula();
    }
  };

  $scope.fetchByMatricula = function() {
    clearMessages();
    if (!$scope.data.matricula) return;
    $scope.state.loading = true;
    $http.get(BASE + "/api/public/student-by-matricula", {
      params: { matricula: $scope.data.matricula }
    }).then(function(resp) {
      const p = resp.data || {};
      $scope.state.fetched = true;
      $scope.data.campus = p.campus || "";
      if (p.student) {
        $scope.data.student_name = p.student.fullName || "";
      }
      if (p.family) {
        $scope.data.parent_email = p.family.email_sugerido || $scope.data.parent_email;
        $scope.data.phone_number = p.family.telefono || $scope.data.phone_number;
        // Prefer padre name if available, else madre
        $scope.data.parent_name = (p.family.padre || p.family.madre || $scope.data.parent_name || "").trim();
      }
    }).catch(function(err) {
      console.warn("fetchByMatricula failed", err);
      $scope.state.error = "No se encontró información con esa matrícula. Puedes continuar llenando el formulario.";
    }).finally(function() {
      $scope.state.loading = false;
    });
  };

  $scope.submit = function() {
    clearMessages();
    if ($scope.state.submitting) return;

    if (!$scope.data.matricula || !$scope.data.reason) {
      $scope.state.error = "Por favor indica matrícula y motivo.";
      return;
    }

    $scope.state.submitting = true;
    const body = {
      matricula: $scope.data.matricula,
      campus: $scope.data.campus,
      student_name: $scope.data.student_name,
      parent_name: $scope.data.parent_name,
      parent_email: $scope.data.parent_email,
      phone_number: $scope.data.phone_number,
      reason: $scope.data.reason,
      is_complaint: !!$scope.data.is_complaint
    };

    $http.post(BASE + "/api/public/parent-tickets", body).then(function(resp) {
      const r = resp.data || {};
      if (r && r.success) {
        $scope.state.success = "Solicitud registrada. Folio: " + (r.folioNumber || r.ticketId);
        // Reset only the reason/complaint to allow multiple related sends without re-typing contact
        $scope.data.reason = "";
        $scope.data.is_complaint = false;
      } else {
        $scope.state.error = "No se pudo registrar la solicitud.";
      }
    }).catch(function(err) {
      console.error("submit failed", err);
      $scope.state.error = (err && err.data && err.data.error) ? err.data.error : "Error de red al enviar la solicitud.";
    }).finally(function() {
      $scope.state.submitting = false;
      $timeout(function(){}, 0);
    });
  };
}]);
