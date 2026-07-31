import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Movimiento } from "../../../core/models/movimiento.model";
import { AuthService } from "../../../core/services/auth.service";
import { MovimientoService } from "../../../core/services/movimiento.service";

@Component({
  selector: "app-movimiento-list",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./movimiento-list.component.html",
  styleUrl: "./movimiento-list.component.css",
})
export class MovimientoListComponent implements OnInit {
  private movimientoService = inject(MovimientoService);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);

  movimientos: Movimiento[] = [];
  cargando = true;
  errorMensaje = "";

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.movimientoService.listar().subscribe({
      next: (res) => {
        this.movimientos = res.data ?? [];
        this.cargando = false;
        // Forzamos manualmente a Angular a repintar la vista con los datos
        // actuales del componente, sin depender de que zone.js lo detecte solo
        // (mismo ajuste ya aplicado en ProductoListComponent).
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error al cargar movimientos:", err);
        this.errorMensaje = "No se pudieron cargar los movimientos";
        this.cargando = false;
        this.cdr.detectChanges();
      },
    });
  }
}
